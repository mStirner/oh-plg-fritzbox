# Introduction
Implements the Fritzbox SmartHome API.<br />
Fetches & Controlls devices via HTTP Polling.

# Supported Devices
| Device     | Supported | Tested | Description                       |
| ---------- | --------- | ------ | --------------------------------- |
| Alarms     | ✅         | ✅      | Works                             |
| Outlets    | ✅         | ✅      | Works                             |
| Thermostat | ✅         | ✅      | Works                             |
| Light      | ❎         | ❎      | Not Implemented/XML Output needed |
| Button     | ❎         | ❎      | Not Implemented/XML Output needed |

> [!NOTE]
> If you want me to add a device type, create a issue. <br />
>  A few informations from you are needed.

# Configuration
- In "Components › Devices" set the Fritzbox host. (Default to fritz.box)
- In "Components › Vault" set the Username & Password for the SmartHome user¹ (Session ID is not needed, created automatically)

---
¹) You should create a dedicated SmartHome user, with the least privliges set possible.

# Development

> [!NOTE]
> The following steps are not needed if you just want to use the plugin<br />
> If you are a **developer**, go ahead!

## Installation
1) Create a new plugin over the OpenHaus backend HTTP API
2) Mount the plugin source code folder into the backend
3) run `npm install`


### 1) Add Pluing Item via HTTP API
Add plugin item via HTTP API:<br />
[PUT] `http://{{HOST}}:{{PORT}}/api/plugins/`
```json
{
   "name":"Fritzbox SmartHome Integration",
   "version":"0.0.1",
   "intents":[
      "devices",
      "endpoints",
      "store",
      "vault"
   ],
   "uuid": "e1e18510-4203-4aa9-bccb-dbc31fe99926"
}
```

### 2) Mount plugin source code
Mount the source code into the backend plugins folder
```sh
sudo mount --bind ~/projects/OpenHaus/plugins/oh-plg-fritzbox/ ~/projects/OpenHaus/backend/plugins/e1e18510-4203-4aa9-bccb-dbc31fe99926/
```

### 3) Install dependencies
```sh
cd ~/projects/OpenHaus/plugins/oh-plg-fritzbox/
npm install
```