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

    _init: function(createIndicator) {
        this.parent();
        this._technologies = {};
        this._serviceTypes = {};
        this._services = {};
        this._createIndicator = createIndicator;
    },

    hide: function() {
        this.actor.hide();
    },

    show: function() {
        this.actor.show();
    },

    addTechnology: function(path, properties) {
        let type = path.split('/').pop();
        Logger.logDebug('Adding technology ' + type);
        if(this._technologies[type])
            return;
        let proxy = new ConnmanInterface.TechnologyProxy(path);
        this._technologies[type] = Technology.createTechnology(type, proxy);
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
        Logger.logInfo('removing technology ' + type);
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
        return this._services[path];
    },

    updateService: function(path, properties) {
        Logger.logDebug('Updating service ' + path);
        if(!this._serviceTypes[path]) {
            var type = properties.Type.deep_unpack().split('/').pop();
        }
        else
            var type = this._serviceTypes[path];
        this._serviceTypes[path] = type;

        if(!this._services[path]) {
            Logger.logDebug('Adding service ' + path);
            let proxy = new ConnmanInterface.ServiceProxy(path);
            let indicator = this._createIndicator();

            let service = Service.createService(type, proxy, indicator);
            this._services[path] = service;
            service.update(properties);
            this._technologies[type].addService(path, service);
            return;
        }
        this._technologies[type].updateService(path, properties);
    },

    removeService: function(path) {
        Logger.logDebug('Removing service ' + path);
        if(!this._serviceTypes[path]) {
            Logger.logInfo('Tried to remove unknown service ' + path);
            return;
        }
        if(!this._technologies[this._serviceTypes[path]]) {
            // technology already deleted
            delete this._technologies[this._serviceTypes[path]];
            return;
        }
        this._technologies[this._serviceTypes[path]].removeService(path);
        delete this._services[path];
        delete this._serviceTypes[path];
        this.fixMenu();
    },

    clear: function() {
        for(let type in this._technologies) {
            try {
                this._technologies[type].destroy();
                delete this._technologies[type];
            }
            catch(error) {
                Logger.logException(error, "Failed to clear technology " + type);
            }
        }
        this._services = {};
        this._technologies = {};
    }
});

/* main applet class handling everything */
const ConnmanApplet = new Lang.Class({
    Name: 'ConnmanApplet',
    Extends: PanelMenu.SystemIndicator,

    _init: function() {
        this.parent();

        this._menu = new ConnmanMenu(this._addIndicator.bind(this));
        this.menu.addMenuItem(this._menu);
        this.menu.actor.show();
    },

    _updateAllServices: function() {
        Logger.logInfo("Updating all services");
        this._manager.GetServicesRemote(function(result, exception) {
            if(!result || exception) {
                Logger.logError('error fetching services: ' + exception);
                return;
            }
            let services = result[0];
            for each(let [path, properties] in services)
                this._menu.updateService(path, properties);
        }.bind(this));
    },

    _updateAllTechnologies: function() {
        Logger.logInfo("Updating all technologies");
        this._menu.clear();
        this._manager.GetTechnologiesRemote(function(result, exception) {
            if(!result || exception) {
                Logger.logError('error fetching technologies: ' + exception);
                return;
            }
            let technologies = result[0];
            for each(let [path, properties] in technologies)
                this._menu.addTechnology(path, properties);
            this._updateAllServices();
        }.bind(this));
    },

    _connectEvent: function() {
        Logger.logInfo('Connected to Connman');
        this.menu.actor.show();

        this._manager = new ConnmanInterface.ManagerProxy();
        this._agent = new ConnmanAgent.Agent(this._menu.getService.bind(this._menu));

        this._manager.RegisterAgentRemote(ConnmanInterface.AGENT_PATH);
        this._asig = this._manager.connectSignal('TechnologyAdded',
                function(proxy, sender, [path, properties]) {
                    try {
                        this._menu.addTechnology(path, properties);
                    }
                    catch(error) {
                        Logger.logException(error);
                    }
                }.bind(this));
        this._rsig = this._manager.connectSignal('TechnologyRemoved',
                function(proxy, sender, [path, properties]) {
                    this._menu.removeTechnology(path);
                }.bind(this));
        this._psig = this._manager.connectSignal('PropertyChanged',
                function(proxy, sender, [property, value]) {
                    Logger.logDebug("Global property " + property +
                            " changed: " + value.deep_unpack());
                }.bind(this));
        this._ssig = this._manager.connectSignal('ServicesChanged',
                function(proxy, sender, [changed, removed]) {
                    Logger.logDebug('Services Changed');
                    try {
                        for each(let [path, properties] in changed) {
                            this._menu.updateService(path, properties);
                        }
                        for each(let path in removed) {
                            this._menu.removeService(path);
                        }
                    }
                    catch(error) {
                        Logger.logException(error);
                    }
                }.bind(this));

        this._updateAllTechnologies();
        this.indicators.show();
    },

    _disconnectEvent: function() {
        Logger.logInfo('Disconnected from Connman');
        this._menu.clear();
        this.menu.actor.hide();
        this.indicators.hide();
        let signals = [this._asig, this._rsig, this._ssig, this._psig];
        if(this._manager) {
            Logger.logDebug("Disconnecting signals");
            for(let signalId in signals) {
                try {
                    Logger.logDebug("Disconnecting signal " + signals[signalId]);
                    this._manager.disconnectSignal(signals[signalId]);
                }
                catch(error) {
                    Logger.logError("Failed to disconnect signal: " + error);
                }
            }
        }
        this._manager = null;
        Logger.logDebug("Destroying agent");
        if(this._agent)
            this._agent.destroy();
        this._agent = null;
    },

    enable: function() {
        Logger.logInfo("Enabling Connman applet");
        if(!this._watch) {
            this._watch = Gio.DBus.system.watch_name(ConnmanInterface.BUS_NAME,
                    Gio.BusNameWatcherFlags.NONE,
                    function() { return this._connectEvent() }.bind(this),
                    function() { return this._disconnectEvent() }.bind(this));

        }
    },

    disable: function() {
        Logger.logInfo("Disabling Connman applet");
        this.menu.actor.hide();
        this._indicator.hide();
        if(this._watch) {
            Gio.DBus.system.unwatch_name(this._watch);
            this._watch = null;
        }
        if(this._agent)
            this._agent.destroy();
        this._agent = null;
    },
});
