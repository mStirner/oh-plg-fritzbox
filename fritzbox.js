const { createHash } = require("crypto");

const xml2js = require("xml2js");

const _request = require("../../helper/request.js");

module.exports = (logger, [device, store, vault]) => {

    // get called every time store or device items are updated
    // re-init httpAgent & interface stuff
    // wrapper for "fritzbox" methods & handling
    // this could be adapted to use internal https://github.com/andig/fritzapi

    let iface = device.interfaces[0];
    let agent = iface.httpAgent();
    let { host, port } = iface.settings;

    agent.on("error", (err) => {
        logger.error(err, "httpAgent() error");
    });

    // this does not work, if SESSION_ID is not set
    // RangeError: Value for secret "Session ID" needs to be set before decrypting, got: null!
    //let { USERNAME, PASSWORD } = vault.decrypt();
    let USERNAME = vault.secrets[0].decrypt();
    let PASSWORD = vault.secrets[1].decrypt();

    async function request(path, options = {}) {

        let { status, body, headers } = await _request(`http://${host}:${port}${path}`, {
            agent,
            ...options
        });

        if (status !== 200) {
            if (status === 403) {

                let err = new Error("Invalid Session ID");
                err.code = "UNAUTHORIZED";

                throw err;

            }
        } else {

            return new Promise((resolve, reject) => {

                if (headers["content-type"].includes("text/xml")) {
                    xml2js.parseString(body.toString(), {
                        explicitArray: false,
                        trim: true
                    }, (err, result) => {
                        if (err) {

                            reject(err);

                        } else {

                            resolve({
                                path,
                                status,
                                body: result,
                            });

                        }
                    });
                } else {

                    resolve({
                        path,
                        status,
                        body,
                    });

                }

            });

        }
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

            if (cmd !== "getdevicelistinfos") {
                console.log("CMD: ", cmd);
                console.log("Response", body);
            }

            return body;

        } catch (err) {

            //console.error(err);
            return Promise.reject(err);

        }
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

    return {
        request,
        getChallenge,
        getSessionID,
        checkSessionID,
        command,
        getDeviceList,
        filter
    };

};