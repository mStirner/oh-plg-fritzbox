const { temp2api, api2temp } = require("./helper.js");
const { labels } = require("./definitions.js");

const bitmasks = require("./bitmasks.js");
const { FUNCTION_ALARM, FUNCTION_THERMOSTAT, FUNCTION_OUTLET, FUNCTION_COLORCONTROL } = bitmasks;

module.exports = async (logger, { getDeviceList, filter, getChallenge, getSessionID, command }, [device, store, vault], [C_DEVICES, C_ENDPOINTS], redo) => {

    let secret = vault.secrets[2];
    let { polling } = store.lean();

    let loop = null;
    let sid = null
    let stop = false;
    let timeout = null;

    try {

        logger.debug(`Start polling loop, ${polling}ms`);

        sid = secret.decrypt();

        C_ENDPOINTS.found({
            device: device._id,
            labels
        }, (endpoint) => {
            try {

                if (endpoint.labels.value("bitmask") & FUNCTION_THERMOSTAT) {

                    endpoint.commands.forEach((cmd) => {
                        cmd.setHandler(({ params }, done) => {

                            logger.verbose("Handle command", cmd.name, params);
                            let ain = endpoint.labels.value("identifier");

                            if (cmd.alias === "TEMP_SHOULD") {

                                let { value } = params.lean();

                                command(sid, "sethkrtsoll", ain, temp2api(value)).then(() => {
                                    done(null, true);
                                }).catch(done);

                            } else {

                                let val = (() => {
                                    switch (cmd.alias) {
                                        case "HEATING_ON": return "on";
                                        case "HEATING_OFF": return "off";
                                    }
                                })();

                                command(sid, "sethkrtsoll", ain, temp2api(val)).then(() => {
                                    done(null, true);
                                }).catch(done);

                            }


                        });
                    });

                } else if (endpoint.labels.value("bitmask") & FUNCTION_OUTLET) {

                    endpoint.commands.forEach((cmd) => {
                        cmd.setHandler(({ params }, done) => {

                            logger.verbose("Handle command", cmd.name, params, endpoint.name);
                            let ain = endpoint.labels.value("identifier");

                            let fnc = "setswitchon";

                            if (cmd.alias === "OFF") {
                                fnc = "setswitchoff";
                            }

                            command(sid, fnc, ain).then(() => {
                                done(null, true);
                            }).catch(done);

                        });
                    });

                }

            } catch (err) {

                console.log("Could not send command for endpoint", err)

            }
        });

        loop = async () => {

            let list = await getDeviceList(sid);

            let endpoints = C_ENDPOINTS.items.filter((endpoint) => {
                return endpoint.device === device._id;
            });

            logger.verbose("Device listed fetche from Firtzbox", list);


            let missing = list.filter((item) => {
                return !endpoints.some((endpoint) => {
                    return endpoint.labels.value("identifier") == item.identifier;
                });
            });


            // ALARMS
            (() => {

                filter(missing, {
                    bitmask: FUNCTION_ALARM
                }).forEach((obj) => {

                    C_ENDPOINTS.add({
                        name: obj.name,
                        device: device._id,
                        icon: "fa-solid fa-circle-exclamation",
                        labels: [
                            `device=${device._id}`,
                            `identifier=${obj.identifier}`,
                            `bitmask=${FUNCTION_ALARM}`,
                            ...labels
                        ],
                        states: [{
                            name: "Alert",
                            alias: "ALERT",
                            type: "boolean",
                            value: obj.alert.state === "1"
                        }, {
                            name: "Present",
                            alias: "PRESENT",
                            type: "boolean",
                            value: obj.present === "true"
                        }, {
                            name: "Batterie",
                            alias: "BATTERY",
                            type: "number",
                            value: parseInt(obj.battery) || 0
                        }]
                    });

                });

                let alarms = filter(list, {
                    bitmask: FUNCTION_ALARM
                });

                C_ENDPOINTS.items.filter((endpoint) => {
                    return endpoint.labels.value("bitmask") & FUNCTION_ALARM;
                }).forEach((endpoint) => {
                    try {

                        let identifier = endpoint.labels.value("identifier");
                        let [alarm, present, battery] = endpoint.states;

                        let obj = alarms.find((item) => {
                            return item.identifier === identifier;
                        });

                        if (!obj) {
                            return;
                        }

                        alarm.value = obj.alert.state === "1";
                        present.value = obj.present === "1";
                        battery.value = parseInt(obj.battery) || null;

                    } catch (err) {

                        logger.warn(err, "Could not set endpoint state");

                    }
                });

            })();


            // THERMOSTAT
            (() => {

                filter(missing, {
                    bitmask: FUNCTION_THERMOSTAT
                }).forEach((obj) => {
                    try {

                        logger.debug(`Add new Thermostat endpoint "${obj.name}"`);

                        if (obj?.present !== "1") {
                            logger.warn(`Endpoint "${obj.name}" item is not present, use default values!`);
                        }

                        C_ENDPOINTS.add({
                            name: obj.name,
                            device: device._id,
                            icon: "fa-solid fa-temperature-high",
                            labels: [
                                `device=${device._id}`,
                                `identifier=${obj.identifier}`,
                                `bitmask=${FUNCTION_THERMOSTAT}`,
                                ...labels
                            ],
                            commands: [{
                                name: "Themperature",
                                alias: "TEMP_SHOULD",
                                interface: device.interfaces[0]._id,
                                params: [{
                                    type: "number",
                                    key: "value",
                                    min: 8,
                                    max: 28
                                }]
                            }, {
                                name: "Off",
                                alias: "HEATING_OFF",
                                interface: device.interfaces[0]._id,
                            }, {
                                name: "On",
                                alias: "HEATING_ON",
                                interface: device.interfaces[0]._id,
                            }],
                            states: [{
                                name: "Temperature",
                                alias: "TEMP_SHOULD",
                                type: "number",
                                value: api2temp(obj.hkr.tsoll) || null,
                                min: 8,
                                max: 28
                            }, {
                                name: "Measured Temp",
                                alias: "TEMP_CURRENT",
                                type: "number",
                                value: api2temp(obj.hkr.tist) || null,
                                min: 8,
                                max: 28
                            }, {
                                name: "Present",
                                alias: "PRESENT",
                                type: "boolean",
                                value: obj.present === "1"
                            }, {
                                name: "Locked",
                                alias: "LOCKED",
                                type: "boolean",
                                value: obj.hkr.lock === "1"
                            }, {
                                name: "Batterie",
                                alias: "BATTERY",
                                type: "number",
                                value: parseInt(obj.battery) || 0
                            }, {
                                name: "Mode",
                                alias: "MODE",
                                type: "string",
                                value: null
                            }]
                        });


                    } catch (err) {

                        logger.warn(err, `Could not add new Thermostat endpoint "${obj.name}" item`);

                    }
                });

                let thermostat = filter(list, {
                    bitmask: FUNCTION_THERMOSTAT
                });

                C_ENDPOINTS.items.filter((endpoint) => {
                    return endpoint.labels.value("bitmask") & FUNCTION_THERMOSTAT;
                }).forEach((endpoint) => {
                    try {

                        let identifier = endpoint.labels.value("identifier");
                        let [TEMP_SHOULD, TEMP_CURRENT, PRESENT, LOCKED, BATTERY, MODE] = endpoint.states;

                        let obj = thermostat.find((item) => {
                            return item.identifier === identifier;
                        });

                        if (!obj) {
                            return;
                        }

                        /*
                        console.group("Endpoint", endpoint.name);
                        console.log("TEMP_SHOULD", obj.hkr.tsoll, api2temp(obj.hkr.tsoll));
                        console.log("TEMP_CURRENT", obj.hkr.tist, api2temp(obj.hkr.tist));
                        console.log("PRESENT", obj.present === "1");
                        console.log("LOCKED", obj.hkr.lock === "1");
                        console.log("BATTERY", parseInt(obj.battery) || 0);
                        console.groupEnd();
                        */

                        TEMP_SHOULD.value = api2temp(obj.hkr.tsoll) || null;
                        TEMP_CURRENT.value = api2temp(obj.hkr.tist) || null;
                        PRESENT.value = obj.present === "1";
                        LOCKED.value = obj.hkr.lock === "1";
                        BATTERY.value = parseInt(obj.battery) || 0;

                        if (obj.hkr.tsoll === "254") {
                            MODE.value = "on";
                        } else if (obj.hkr.tsoll === "253") {
                            MODE.value = "off";
                        } else {
                            MODE.value = "heating";
                        }

                    } catch (err) {

                        logger.warn(err, "Could not set endpoint state");

                    }
                });

            })();


            // SOCKETS/PLUGS/OUTLETS
            (() => {

                filter(missing, {
                    bitmask: FUNCTION_OUTLET
                }).forEach((obj) => {

                    C_ENDPOINTS.add({
                        name: obj.name,
                        device: device._id,
                        icon: "fa-solid fa-plug",
                        labels: [
                            `device=${device._id}`,
                            `identifier=${obj.identifier}`,
                            `bitmask=${FUNCTION_OUTLET}`,
                            ...labels
                        ],
                        commands: [{
                            name: "On",
                            alias: "ON",
                            interface: device.interfaces[0]._id,
                        }, {
                            name: "Off",
                            alias: "OFF",
                            interface: device.interfaces[0]._id,
                        }],
                        states: [{
                            name: "State",
                            alias: "STATE",
                            type: "number",
                            value: parseInt(obj?.switch?.state || 0)
                        }, {
                            name: "Locked",
                            alias: "LOCKED",
                            type: "boolean",
                            value: obj?.switch?.lock === "1"
                        }, {
                            name: "Mode",
                            alias: "MODE",
                            type: "string",
                            value: obj?.switch?.mode || "unknown"
                        }, {
                            name: "Present",
                            alias: "PRESENT",
                            type: "boolean",
                            value: obj.present === "1"
                        }, {
                            name: "Voltage",
                            alias: "VOLTAGE",
                            type: "number",
                            value: Math.floor(parseInt(obj?.powermeter?.voltage || 0) / 1000)
                        }, {
                            name: "Power",
                            alias: "POWER",
                            type: "number",
                            value: Math.floor(parseInt(obj?.powermeter?.power || 0) / 1000)
                        }, {
                            name: "Energy",
                            alias: "ENERGY",
                            type: "number",
                            value: parseInt(obj?.powermeter?.energy || 0)
                        }, {
                            name: "Temperature",
                            alias: "TEMPERATURE",
                            type: "number",
                            value: Math.floor(parseInt(obj?.temperature?.celsius || 0) / 10)
                        }]
                    });

                });


                let outlets = filter(list, {
                    bitmask: FUNCTION_OUTLET
                });

                C_ENDPOINTS.items.filter((endpoint) => {
                    return endpoint.labels.value("bitmask") & FUNCTION_OUTLET;
                }).forEach((endpoint) => {
                    try {

                        let identifier = endpoint.labels.value("identifier");
                        let [state, locked, mode, present, voltage, power, energy, temperature] = endpoint.states;

                        let obj = outlets.find((item) => {
                            return item.identifier === identifier;
                        });

                        if (!obj) {
                            return;
                        }

                        state.value = parseInt(obj?.switch?.state || 0);
                        locked.value = obj?.switch?.lock === "1";
                        mode.value = obj?.switch?.mode || "unknown";
                        present.value = obj.present === "1";
                        voltage.value = Math.floor(parseInt(obj?.powermeter?.voltage || 0) / 1000);
                        power.value = Math.floor(parseInt(obj?.powermeter?.power || 0) / 1000);
                        energy.value = parseInt(obj?.powermeter?.energy || 0);
                        temperature.value = Math.floor(parseInt(obj?.temperature?.celsius || 0) / 10);

                    } catch (err) {

                        logger.warn(err, "Could not set endpoint state");

                    }
                });

            })();

            if (!stop) {
                timeout = setTimeout(loop, polling);
            }

        }

        await loop();

    } catch (err) {

        logger.error(err, "Catched Error:")

        stop = true;
        clearTimeout(timeout);

        if (err.code === "UNAUTHORIZED" || err.message === 'Value for secret "Session ID" needs to be set before decrypting, got: null!') {
            try {

                let challenge = await getChallenge();
                sid = await getSessionID(challenge);

                // save new session id
                // wait for bootstrap to re-init due to changes
                await secret.encrypt(sid);
                setTimeout(redo, polling);

            } catch (err) {

                logger.warn(err, "Could not get or store session id, retry...");
                setTimeout(redo, polling);

            }
        } /* else if (err.code === "TIMEDOUT" || err === "TIMEDOUT") {

            // does not work, never reached
            // what does a connecton attempt return?

        } */ else {

            logger.error(err, "Could not fetch device list:");
            setTimeout(redo, polling);

        }

    }

}