# Authorization Extension Provisioning Tool

This sample tool shows how you can provision groups, roles and permissions in the Authorization Extension using the API with a simple node package.

## Configuring the Extension

In the extension go to the **API** section and enable API access:

![](/screenshots/configure-extension-api.png)

After saving this page an API (Resource Server) will be created in your Auth0 account.

## Configuring Auth0

Go to your Auth0 account and create a non-interactive client. Authorize it for the Authorization Extension API and give it the following scopes:

  - `read/edit/create:permissions`
  - `read/edit/create:roles`
  - `read/edit/create:groups`

![](/screenshots/configure-account.png)

Also create a normal client and give them a name like "Timesheet App". In the `data` array, search for `timesheet-app-id` and replace these with the Client ID of your client.

## Configure the Provisioning Tool

Update the `process.env` with these settings:

```
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=client-id-of-your-non-interactive-client
AUTH0_CLIENT_SECRET=client-secret-of-your-non-interactive-client
AUTHZ_API_URL=https://url-of-the-extension-api-which-you-see-on-the-api-tab/api
```

## Run

Now run the tool:

```
const Authz = require('authz-extension-api');

const authz = new Authz();

const data = {
  "applications": [
    {
      "id": "timesheet-app-id",
      "permissions": [
        "read:own-TimeStamps",
        "update:own-TimeStamps",
        "read:TimeStamps",
        "update:TimeStamps",
        "approve:TimeStamps",
        "reject:TimeStamps"
      ],
      "roles": [
        {
          "name": "Timeclock Admin",
          "description": "Role given to contractors",
          "permissions": [
            "read:own-TimeStamps",
            "update:own-TimeStamps"
          ]
        },
        {
          "name": "Timeclock Owner",
          "description": "Role given to users that can manage TimeStamps",
          "permissions": [
            "read:TimeStamps",
            "update:TimeStamps",
            "approve:TimeStamps",
            "reject:TimeStamps"
          ]
        }
      ]
    },
  ],
  "groups": [
    {
      "name": "Sales",
      "description":"test"
    },
    {
      "name": "Research & Development",
      "description":"test",
      "nested": [
        "Sales"
      ]
    }
  ]
};

/*
 * Provision roles, groups and permissions.
 */
authz.getAccessToken()
  .then(accessToken => authz.provision(data))
  .catch(err => {
    log(chalk.red.bold('Error:'), JSON.stringify({ error: err.error || err.message, options: err.options }, null, 2));
  });

/*
 * Provision just permissions.
 */
authz.getAccessToken()
  .then(accessToken => authz.provisionPermissions(data))
  .catch(err => {
    log(chalk.red.bold('Error:'), JSON.stringify({ error: err.error || err.message, options: err.options }, null, 2));
  });

/*
 * Provision roles and permissions.
 */
authz.getAccessToken()
  .then(accessToken => authz.provisionRoles(data))
  .catch(err => {
    log(chalk.red.bold('Error:'), JSON.stringify({ error: err.error || err.message, options: err.options }, null, 2));
  });

/*
 * Provision just groups.
 */
authz.getAccessToken()
  .then(accessToken => authz.provisionGroups(data))
  .catch(err => {
    log(chalk.red.bold('Error:'), JSON.stringify({ error: err.error || err.message, options: err.options }, null, 2));
  });

```

Go back to your extension and you'll see that it's filled with data.
