/*
 * Copyright (C) 2015 Intel Corporation. All rights reserved.
 * Author: Jaakko Hannikainen <jaakko.hannikainen@intel.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const ConnmanAgent = Ext.imports.connmanAgent;
const ConnmanInterface = Ext.imports.connmanInterface;
const Logger = Ext.imports.logger;
const Service = Ext.imports.service;
const Technology = Ext.imports.technology;

/* menu with technologies and services */
const ConnmanMenu = new Lang.Class({
    Name: 'ConnmanMenu',
    Extends: PopupMenu.PopupMenuSection,

    _init: function() {
        this.parent();
        this._technologies = {};
        this._serviceTypes = {};
    },

    hide: function() {
        this.actor.hide();
    },

    show: function() {
        this.actor.show();
    },

    addTechnology: function(path, properties) {
        let type = path.split('/').pop();
        Logger.logInfo('Adding technology ' + type);
        if(this._technologies[type])
            return;
        let proxy = new ConnmanInterface.TechnologyProxy(path);
        try {
            this._technologies[type] = Technology.createTechnology(type, proxy,
                this._manager);
        } catch(error) {
            Logger.logException(error, 'Failed to add technology');
            return;
        }
        this.addMenuItem(this._technologies[type]);
    },

    /* FIXME: for some reason destroying an item from the menu
     * leaves a hole, but for some reason this fixes it */
    fixMenu: function() {
        this.addMenuItem(new PopupMenu.PopupMenuItem('Connman'), 0);
        this.firstMenuItem.destroy();
    },

    removeTechnology: function(path) {
        let type = path.split('/').pop();
        Logger.logInfo('Removing technology ' + type);
        let technology = this._technologies[type];
        if(!technology) {
            Logger.logInfo('Tried to remove unknown technology ' + type);
            return;
        }
        technology.destroy();
        delete this._technologies[type];
        this.fixMenu();
    },

    getService: function(path) {
        if(!this._serviceTypes[path])
            return null;
        if(!this._technologies[this._serviceTypes[path]])
            return null;
        return this._technologies[this._serviceTypes[path]].getService(path);
    },

    addService: function(path, properties, indicator) {
        Logger.logDebug('Adding service ' + path);
        let type;
        if(properties.Type)
            type = properties.Type.deep_unpack().split('/').pop();
        else
            type = path.split('/').pop().split('_')[0];
        this._serviceTypes[path] = type;

        let proxy = new ConnmanInterface.ServiceProxy(path);
        let service = Service.createService(type, proxy, indicator);
        service.update(properties);
        this._technologies[type].addService(path, service);
    },

    updateService: function(path, properties) {
        if(this._serviceTypes[path]) {
            Logger.logDebug('Updating service ' + path);
            var type = this._serviceTypes[path];
            this._technologies[type].updateService(path, properties);
            return;
        } else
            this.addService(path, properties);
    },

    removeService: function(path) {
        if(!this._serviceTypes[path]) {
            Logger.logInfo('Tried to remove unknown service ' + path);
            return;
        }
        if(this._technologies[this._serviceTypes[path]]) {
            Logger.logDebug('Removing service ' + path);
            this._technologies[this._serviceTypes[path]].removeService(path);
        }
        delete this._serviceTypes[path];
        this.fixMenu();
    },

    clear: function() {
        for(let type in this._technologies) {
            try {
                this._technologies[type].destroy();
                delete this._technologies[type];
            } catch(error) {
                Logger.logException(error, 'Failed to clear technology ' + type);
            }
        }
        this._serviceTypes = {};
        this._technologies = {};
    }
});

/* main applet class handling everything */
const ConnmanApplet = new Lang.Class({
    Name: 'ConnmanApplet',
    Extends: PanelMenu.SystemIndicator,

    _init: function() {
        this.parent();

        this._menu = new ConnmanMenu();
        this.menu.addMenuItem(this._menu);
        this.menu.actor.show();
    },

    _updateService: function(path, properties) {
        if(this._menu.getService(path))
            this._menu.updateService(path, properties);
        else
            this._menu.addService(path, properties, this._addIndicator());
    },

    _updateAllServices: function() {
        Logger.logInfo('Updating all services');
        this._manager.GetServicesRemote(function(result, exception) {
            if(!result || exception) {
                Logger.logError('Error fetching services: ' + exception);
                return;
            }
            let services = result[0];
            for each(let [path, properties] in services)
                this._updateService(path, properties);

        }.bind(this));
    },

    _updateAllTechnologies: function() {
        Logger.logInfo('Updating all technologies');
        this._menu.clear();
        this._manager.GetTechnologiesRemote(function(result, exception) {
            if(!result || exception) {
                Logger.logError('Error fetching technologies: ' + exception);
                return;
            }
            let technologies = result[0];
            for each(let [path, properties] in technologies)
                this._menu.addTechnology(path, properties);
            this._menu._technologies['vpn'] = Technology.createTechnology('vpn');
            this._menu.addMenuItem(this._menu._technologies['vpn']);
            this._updateAllServices();
        }.bind(this));
    },

    _connectEvent: function() {
        Logger.logInfo('Connected to Connman');
        this.menu.actor.show();

        this._manager = new ConnmanInterface.ManagerProxy();
        this._menu._manager = this._manager;
        this._vpnManager = new ConnmanInterface.VPNManagerProxy();
        this._agent = new ConnmanAgent.Agent();
        this._vpnAgent = new ConnmanAgent.VPNAgent();

        this._manager.RegisterAgentRemote(ConnmanInterface.AGENT_PATH);
        this._vpnManager.RegisterAgentRemote(ConnmanInterface.VPN_AGENT_PATH);
        this._asig = this._manager.connectSignal('TechnologyAdded',
            function(proxy, sender, [path, properties]) {
                try {
                    this._menu.addTechnology(path, properties);
                } catch(error) {
                    Logger.logException(error);
                }
            }.bind(this));
        this._rsig = this._manager.connectSignal('TechnologyRemoved',
            function(proxy, sender, [path, properties]) {
                this._menu.removeTechnology(path);
            }.bind(this));
        this._psig = this._manager.connectSignal('PropertyChanged',
            function(proxy, sender, [property, value]) {
                Logger.logDebug('Global property ' + property +
                    ' changed: ' + value.deep_unpack());
            }.bind(this));
        this._ssig = this._manager.connectSignal('ServicesChanged',
            function(proxy, sender, [changed, removed]) {
                try {
                    for each(let [path, properties] in changed)
                        this._updateService(path, properties);
                    for each(let path in removed)
                        this._menu.removeService(path);
                } catch(error) {
                    Logger.logException(error);
                }
            }.bind(this));

        this._updateAllTechnologies();
        this.indicators.show();
    },

    _disconnectEvent: function() {
        Logger.logInfo('Disconnected from Connman');
        this._menu.clear();
        this._menu._manager = null;
        this.menu.actor.hide();
        this.indicators.hide();
        let signals = [this._asig, this._rsig, this._ssig, this._psig];
        if(this._manager) {
            Logger.logDebug('Disconnecting signals');
            for(let signalId in signals) {
                try {
                    Logger.logDebug('Disconnecting signal ' + signals[signalId]);
                    this._manager.disconnectSignal(signals[signalId]);
                } catch(error) {
                    Logger.logException(error, 'Failed to disconnect signal');
                }
            }
        }
        this._manager = null;
        this._vpnManager = null;
        if(this._agent)
            this._agent.destroy();
        if(this._vpnAgent)
            this._vpnAgent.destroy();
        this._agent = null;
        this.vpnAgent = null;
    },

    enable: function() {
        Logger.logInfo('Enabling Connman applet');
        if(!this._watch) {
            this._watch = Gio.DBus.system.watch_name(ConnmanInterface.BUS_NAME,
                Gio.BusNameWatcherFlags.NONE,
                this._connectEvent.bind(this),
                this._disconnectEvent.bind(this));
        }
    },

    disable: function() {
        Logger.logInfo('Disabling Connman applet');
        this._disconnectEvent();
        this._menu.clear();
        this.indicators.hide();
        this.menu.actor.hide();
        if(this._watch)
            Gio.DBus.system.unwatch_name(this._watch);
        if(this._agent)
            this._agent.destroy();
        if(this._vpnAgent)
            this._vpnAgent.destroy();
        this._agent = null;
        this._vpnAgent = null;
        this._watch = null;
    },
});
