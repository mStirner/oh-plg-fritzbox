const http = require("http");
const xml2js = require("xml2js");

const { labels } = require("./definitions.js");
const fritzbox = require("./fritzbox.js");

module.exports = async (logger, [C_DEVICES, C_STORE, C_VAULT]) => {

    let device = await new Promise((resolve) => {
        C_DEVICES.found({
            labels
        }, resolve);
    });

    let store = await new Promise((resolve) => {
        C_STORE.found({
            labels: [
                ...labels,
                `device=${device._id}`
            ]
        }, resolve);
    });

    let vault = await new Promise((resolve) => {
        C_VAULT.found({
            labels: [
                ...labels,
                `device=${device._id}`
            ]
        }, resolve);
    });



    let { getChallenge, getSessionID } = fritzbox(logger, [
        device,
        store,
        vault
    ]);


    let challenge = await getChallenge();
    let sid = await getSessionID(challenge);



};