# Introduction
This is a boilerplate plugin.

# Installation
1) Create a new plugin over the OpenHaus backend HTTP API
2) Mount the plugin source code folder into the backend
3) run `npm install`

# Development
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

Mount the source code into the backend plugins folder
```sh
sudo mount --bind ~/projects/OpenHaus/plugins/oh-plg-fritzbox/ ~/projects/OpenHaus/backend/plugins/e1e18510-4203-4aa9-bccb-dbc31fe99926/
```
