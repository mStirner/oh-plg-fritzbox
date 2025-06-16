const http = require("http");
const { createHash } = require('crypto');
//const FormData = require('form-data');
const xml2js = require("xml2js");

const { temp2api, api2temp } = require("../helper.js");
const { FUNCTION_ALARM, FUNCTION_THERMOSTAT } = require("../bitmasks.js");

const PASSWORD = "Pa$$w0rd";
const USERNAME = "OpenHaus";

function request(url, options) {
    return new Promise(async (resolve, reject) => {

        options = Object.assign({
            end: true,
            toString: true,
            headers: {
                ...options?.headers
            }
        }, options);

        /*
        let form = new FormData();

        if (options.body) {
            await new Promise((resolve, reject) => {

                Object.keys(options.body).forEach((key) => {
                    form.append(key, options.body[key]);
                });

                Object.assign(options.headers, form.getHeaders());

                form.getLength((err, length) => {
                    if (err) {
                        reject(err);
                    } else {

                        options.headers["content-length"] = length;
                        resolve();

                    }
                });


            });
        }
        */


        let req = http.request(`http://fritz.box${url}`, {
            method: "GET",
            ...options
        }, (res) => {

            let chunks = [];

            res.once("error", (error) => {
                reject({
                    error,
                    url,
                    res,
                    res,
                });
            });

            res.on("data", (chunk) => {
                chunks.push(chunk);
            });

            res.on("end", () => {

                if (res.statusCode === 403) {
                    reject(new Error("Invlid Session code"));
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Invalid status code (${res.statusCode})`));
                }

                let body = Buffer.concat(chunks);

                if (chunks.length > 0 && res.headers["content-type"].includes("text/xml")) {

                    xml2js.parseString(body.toString(), {
                        explicitArray: false,
                        trim: true,
                        //explicitRoot: false
                    }, (err, result) => {
                        if (err) {

                            reject(err);

                        } else {

                            resolve({
                                url,
                                status: res.statusCode,
                                body: result,
                                req,
                                res,
                            });

                        }
                    });

                } else {

                    resolve({
                        url,
                        status: res.statusCode,
                        body: options.toString ? body.toString() : body,
                        req,
                        res,
                    });

                }

            });

        });


        if (options?.body) {
            //form.pipe(req);
            req.end(options.body);
        } else {
            req.end();
        }

    });
}



async function getChallenge() {
    // https://fritz.box/login_sid.lua?version=2    = pbkf
    // https://fritz.box/login_sid.lua              = md5
    let { body } = await request("/login_sid.lua");
    return body?.SessionInfo?.Challenge;
}

async function getSessionID(challenge) {

    console.log("challenge", challenge)

    let buff = Buffer.from(`${challenge}-${PASSWORD}`, 'UTF-16LE');
    let checksum = createHash('md5').update(buff).digest('hex');
    let response = `${challenge}-${checksum}`;

    let { body } = await request(`/login_sid.lua?username=${USERNAME}&response=${response}`);
    let sessionID = body?.SessionInfo?.SID;

    if (sessionID === "0000000000000000") {
        throw new Error("Login invliad - invalid session id returned");
    }

    console.log("SessionID", sessionID)

    return sessionID;

}

async function checkSessionID(sid) {

    let { body } = await request(`/login_sid.lua?sid=${sid}`);

    if (body.SessionInfo.SID === sid) {
        return true;
    }

    return false

}


async function command(sid, cmd, ain, param) {
    try {

        let query = new URLSearchParams();

        query.set("sid", sid);
        query.set("switchcmd", cmd)

        if (ain) {
            query.set("ain", ain);
        }

        if (param) {
            query.set("param", param);
        }

        let { body } = await request(`/webservices/homeautoswitch.lua?${query.toString()}`);

        return body;

    } catch (err) {

        //console.error(err);
        return Promise.reject(err);

    }
}


async function setTemp(sid, ain, temp) {
    let value = temp2api(temp);

    console.log("converted value", `${temp}=${value}`);
    return await command(sid, "sethkrtsoll", ain, value);

}

async function getDeviceList(sid) {
    try {

        let { devicelist: { device = [] } } = await command(sid, "getdevicelistinfos");

        return device.map((device) => {

            device.identifier = device.$.identifier.replace(/\s/g, '');
            device.id = device.$.id;
            device.functionbitmask = device.$.functionbitmask;
            device.fwversion = device.$.fwversion;
            device.manufacturer = device.$.manufacturer;
            device.productname = device.$.productname;

            //delete device.$; // this, deletes "presents" prop also
            return device;

        });

    } catch (err) {

        console.error(err);
        return Promise.reject(err);

    }
}


function filter(list, filter) {
    return list.filter((device) => {
        return Object.keys(filter).every((key) => {
            if (key === "bitmask") {
                return device.functionbitmask & filter[key];
            } else {
                return device[key] == filter[key];
            }
        });
    });
}

(async () => {

    console.log("Started");

    let loop = null;
    let sid = null;
    let stop = false;
    let timeout = null;

    try {

        loop = async () => {

            let list = await getDeviceList(sid);

            console.clear();
            console.log("Updated:", Date.now());
            console.log();

            (() => {

                let devices = filter(list, {
                    bitmask: FUNCTION_ALARM
                });

                let table = devices.map((device) => {

                    const time = new Date(device.alert?.lastalertchgtimestamp * 1000).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(',', ' -');

                    return {
                        name: device.name,
                        alert: device.alert.state === "1",
                        changed: time,
                        present: device.present === "1",
                        identifier: device.identifier
                    };

                });

                console.log("Bewerbungsmelder/Fensterkontakte")
                console.table(table);

            })();

            console.log();

            (() => {

                let devices = filter(list, {
                    bitmask: FUNCTION_THERMOSTAT
                });

                let table = devices.map((device) => {
                    return {
                        temp: parseInt(device.temperature.celsius) / 10,
                        name: device.name,
                        tsoll: api2temp(device.hkr.tsoll),
                        tist: api2temp(device.hkr.tist),
                        battery: `${device.battery}%`,
                        locked: device.hkr.lock === "1",
                        present: device.present === "1",
                        identifier: device.identifier
                    };
                });

                console.log("Thermostate");
                console.table(table);

            })();

            if (!stop) {
                timeout = setTimeout(loop, 5000);
            }

        }

        await loop();

    } catch (err) {

        stop = true;
        clearTimeout(timeout);
        
        console.error("catched in main", err);

        if (err.message === "Invlid Session code") {

            let challenge = await getChallenge();
            sid = await getSessionID(challenge);

            stop = false;
            await loop();

        }

    }

})();
