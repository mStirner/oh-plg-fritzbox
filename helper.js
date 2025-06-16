const MIN_TEMP = 8;
const MAX_TEMP = 28;

function temp2api(temp) {
    var res;

    if (temp == 'on' || temp === true)
        res = 254;
    else if (temp == 'off' || temp === false)
        res = 253;
    else {
        // 0.5C accuracy
        res = Math.round((Math.min(Math.max(temp, MIN_TEMP), MAX_TEMP) - 8) * 2) + 16;
    }

    return res;
}


function api2temp(param) {
    if (param == 254)
        return 254;
    else if (param == 253)
        return 0;
    else {
        // 0.5C accuracy
        return (parseFloat(param) - 16) / 2 + 8;
    }
}

module.exports = {
    temp2api,
    api2temp
};