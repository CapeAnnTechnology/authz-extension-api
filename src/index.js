const chalk = require('chalk');
const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

const log = console.log;

"use strict";

// Build out our basic Authz type
module.exports = class Authz {
	constructor () {
		this.credentials = {
		  audience: 'urn:auth0-authz-api',
		  client_id: process.env.AUTH0_CLIENT_ID,
		  client_secret: process.env.AUTH0_CLIENT_SECRET,
		  grant_type: 'client_credentials'
		};
	 }

	/*
	 * Get an access token for the Authorization Extension API.
	 */
	getAccessToken() {
	  log(chalk.blue.bold('Authorize:'), `Getting access token for ${this.credentials.audience}`);
	  return request.post({ uri: 'https://' + process.env.AUTH0_DOMAIN + '/oauth/token', form: this.credentials, json: true })
	    .then(res => { this.accessToken = res.access_token; res.access_token;});
	}

	/*
	 * Provision roles, groups and permissions.
	 */
	 provision(data) {
	  return Promise.all([ this.getPermissions(), this.getRoles(), this.getGroups() ])
	    .then(([ existingPermissions, existingRoles, existingGroups ]) => {
	      Promise.mapSeries(data.applications, (application) =>
	        Promise.mapSeries(application.permissions, (permission) =>
	          this.createPermission(existingPermissions, application, permission)
	        )
	      )
	      .then(() => Promise.mapSeries(data.applications, (application) =>
	          Promise.mapSeries(application.roles, (role) =>
	            this.createRole(existingRoles, application, role)
	              .then(() => this.addRolePermissions(existingRoles, existingPermissions, application, role))
	          )
	        ))
	      .then(() => Promise.mapSeries(data.groups, (group) =>
	        this.createGroup(existingGroups, group)
	          .then(() => this.createNestedGroups(existingGroups, group))
	      ))
	    });
	}

	/*
	 * Get a list of all permissions in the extension.
	 */
	 getPermissions() {
	  return request.get({ uri: process.env.AUTHZ_API_URL + '/permissions', json: true, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then(res => {
	      log(chalk.green.bold('Permissions:'), `Loaded ${res.permissions.length} permissions.`);
	      return res.permissions;
	    });
	}

	/*
	 * Create a permission if it doesn't exist yet.
	 */
	 createPermission(existingPermissions, application, permission) {
	  const existingPermission = _.find(existingPermissions, { applicationId: application.id, name: permission });
	  if (existingPermission) {
	    return Promise.resolve(true);
	  }

	  const payload = {
	    name: permission,
	    description: permission.replace(/(\w)(\w*)/g, function(g0,g1,g2){return g1.toUpperCase() + g2.toLowerCase();}).replace(':', ' ').replace('-', ' '),
	    applicationType: 'client',
	    applicationId: application.id
	  };

	  return request.post({ uri: process.env.AUTHZ_API_URL + '/permissions', json: payload, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then((createdPermission) => {
	      existingPermissions.push(createdPermission);
	      log(chalk.green.bold('Permission:'), `Created ${permission}`);
	      return permission;
	    });
	}

	/*
	 * Get a list of all roles in the extension.
	 */
	 getRoles() {
	  return request.get({ uri: process.env.AUTHZ_API_URL + '/roles', json: true, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then(res => {
	      log(chalk.green.bold('Roles:'), `Loaded ${res.roles.length} roles.`);
	      return res.roles;
	    });
	}

	/*
	 * Create a role if it doesn't exist yet.
	 */
	 createRole(existingRoles, application, role) {
	  const existingRole = _.find(existingRoles, { applicationId: application.id, name: role.name });
	  if (existingRole) {
	    return Promise.resolve(true);
	  }

	  const payload = {
	    name: role.name,
	    description: role.description,
	    applicationType: 'client',
	    applicationId: application.id
	  };

	  return request.post({ uri: process.env.AUTHZ_API_URL + '/roles', json: payload, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then((createdRole) => {
	      existingRoles.push(createdRole);
	      log(chalk.green.bold('Role:'), `Created ${role.name}`);
	      return role;
	    });
	}

	/*
	 * Add permsisions to role
	 */
	 addRolePermissions(existingRoles, existingPermissions, application, role) {
	  if (!role.permissions || role.permissions.length == 0) {
	    return Promise.resolve();
	  }

	  const existingRole = _.find(existingRoles, { applicationId: application.id, name: role.name });
	  const existingRoleId = existingRole._id;
	  delete existingRole._id;
	  existingRole.permissions = role.permissions.map(permissionName => {
	    const permission = _.find(existingPermissions, { applicationId: application.id, name: permissionName });
	    return permission._id;
	  });

	  log(chalk.blue.bold('Role:'), `Adding permissions to ${existingRole.name} (${existingRoleId})...`);
	  return request.put({ uri: process.env.AUTHZ_API_URL + '/roles/' + existingRoleId, json: existingRole, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then(() => {
	      log(chalk.green.bold('Role:'), `Added ${existingRole.permissions.length} permissions ${role.name}`);
	      return Promise.resolve(true);
	    });
	}


	/*
	 * Get a list of all groups in the extension.
	 */
	 getGroups() {
	  return request.get({ uri: process.env.AUTHZ_API_URL + '/groups', json: true, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then(res => {
	      log(chalk.green.bold('Groups:'), `Loaded ${res.groups.length} groups.`);
	      return res.groups;
	    });
	}

	/*
	 * Create a group if it doesn't exist yet.
	 */
	createGroup(existingGroups, group) {
	  const existingGroup = _.find(existingGroups, { name: group.name });
	  if (existingGroup) {
	    return Promise.resolve(true);
	  }

	  const payload = {
	    name: group.name,
	    description: group.description
	  };

	  return request.post({ uri: process.env.AUTHZ_API_URL + '/groups', json: payload, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then((createdGroup) => {
	      existingGroups.push(createdGroup);
	      log(chalk.green.bold('Group:'), `Created ${group.name}`);
	      return group;
	    });
	}

	/*
	 * Create add nested groups to a group.
	 */
	 createNestedGroups(existingGroups, group) {
	  if (!group.nested || group.nested.length == 0) {
	    return Promise.resolve();
	  }

	  const existingGroup = _.find(existingGroups, { name: group.name });
	  const payload = group.nested.map(nestedGroupName => {
	    const nestedGroup = _.find(existingGroups, { name: nestedGroupName.name, description: nestedGroupName.description });
	    return nestedGroup._id;
	  });

	  return request.patch({ uri: process.env.AUTHZ_API_URL + '/groups/' + existingGroup._id + '/nested', json: payload, headers: { 'Authorization': 'Bearer ' + this.accessToken } })
	    .then(() => {
	      log(chalk.green.bold('Nested Group:'), `Added ${group.nested.join(', ')} to ${group.name}`);
	      return Promise.resolve(true);
	    });
	}

};