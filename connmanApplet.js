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
const ConnmanInterface = Ext.imports.connmanInterface;

function signalToIcon(value) {
    if (value > 80)
        return "excellent";
    if (value > 55)
        return "good";
    if (value > 30)
        return "ok";
    if (value > 5)
        return "weak";
    return "excellent";
}

function getIcon(type, strength) {
    switch (type) {
        case "ethernet":
            return "network-wired-symbolic";
        case "cellular":
            return "network-cellular-signal-" + signalToIcon(strength) + "-symbolic";
        case "bluetooth":
            return "bluetooth-active-symbolic";
        case "wifi":
            return "network-wireless-signal-" + signalToIcon(strength) + "-symbolic";
        case "vpn":
            return "network-vpn-symbolic";
        default:
            return "network-offline-symbolic";
    }
}

function getAcquiringIcon(type){
    switch (type) {
        case "wifi":
            return "network-wireless-acquiring-symbolic";
        case "cellular":
            return "network-cellular-acquiring-symbolic";
        case "ethernet":
            return "network-wired-acquiring-symbolic";
        case "vpn":
            return "network-vpn-acquiring-symbolic";
        case "bluetooth":
            return "bluetooth-active-symbolic";
        default :
            return "network-wireless-acquiring-symbolic";
    }
}

function getStatusIcon(type, state, strength) {
    switch(state) {
        case "online":
        case "ready":
            return getIcon(type, strength);
        case "configuration":
        case "association":
            return getAcquiringIcon(type);
        case "disconnect":
        case "idle":
            return "network-offline-symbolic";
        case "failure":
        default:
            return "network-error-symbolic";
    }
}

/* specific submenu for a technology */
const TechnologyMenu = new Lang.Class({
    Name: "TechnologyMenu",
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function(proxy, powered) {
        this.parent("", true);
        this._proxy = proxy;
        this.powered = powered;
        this._powerSwitch = new PopupMenu.PopupMenuItem("Power");
        this._powerSwitch.connect('activate', function() {
            this.powered = !this.powered;
            let powered = GLib.Variant.new('b', this.powered);
            this._proxy.SetPropertyRemote('Powered', powered);
            this.update();
        }.bind(this));
        this.menu.addMenuItem(this._powerSwitch);
    },

    update: function() {
        if(this.powered)
            this._powerSwitch.label.text = "Turn Off";
        else
            this._powerSwitch.label.text = "Turn On";
    },

});

/* This class handles specific technology with an indicator and a submenu. */
const Technology = new Lang.Class({
    Name: "Technology",
    Extends: PopupMenu.PopupMenuSection,

    _init: function(indicator, type, properties) {
        this.parent();
        this._indicator = indicator;
        this._indicator.icon_name = "network-wired-disconnected-symbolic";
        this._indicator.show();

        this._type = type.split("/").pop();

        this._proxy = new ConnmanInterface.TechnologyProxy(type);
        this._menu = new TechnologyMenu(this._proxy, properties.Powered.deep_unpack());

        this.addMenuItem(this._menu);

        this.update(properties);
    },

    update: function(properties) {
        if(properties.State)
            this.state = properties.State.deep_unpack();
        if(properties.Strength)
            this.strength = properties.Strength.deep_unpack();
        if(properties.Powered) {
            this._menu.powered = properties.Powered.deep_unpack();
            this._menu.update();
        }

        this.icon = getStatusIcon(this.type, this.state, this.strength);
        if(properties.Name)
            this.name = properties.Name.deep_unpack();

        if(this.name)
            this._menu.label.text = this.name;
        if(this.icon)
            this._menu.icon.icon_name = this.icon;
        if(this.state)
            this._menu.status.text = this.state;
    },

    destroy: function() {
        this._indicator.destroy();
        this.parent();
    }
});

/* menu with technologies and services */
const ConnmanMenu = new Lang.Class({
    Name: "ConnmanMenu",
    Extends: PopupMenu.PopupMenuSection,

    _init: function(addIndicator) {
        this.parent();
        this._technologies = {};
        this._services = {};
        this._addIndicator = addIndicator;
    },

    hide: function() {
        this.actor.hide();
    },

    show: function() {
        this.actor.show();
    },

    addTechnology: function(type, properties) {
        if(this._technologies[type])
            return;

        this._technologies[type] = new Technology(this._addIndicator(),
                type, properties);
        this.addMenuItem(this._technologies[type]);
    },

    removeTechnology: function(type) {
        let technology = this._technologies[type];
        if(!technology)
            return;
        technology.destroy();
        delete this._technologies[type];
        /* FIXME: for some reason destroying the technology
         * leaves a hole, but for some reason this fixes it */
        this.addMenuItem(new PopupMenu.PopupMenuItem("Connman"), 0);
        this.firstMenuItem.destroy();
    },

    updateService: function(path, properties) {
        log(path);
        log(properties);
        let type = properties.Type.deep_unpack();
        let technology = this._technologies[type];
        if(!technology)
            return;
        switch(type.split("/").pop()) {
            case "ethernet":
        }
        if(!this._services[path]) {
            this._services[path] = new Service(path, properties);
            technology.addService(this._services[path]);
        }
        else
            this._services[path].update(properties);
    },

    removeService: function(path) {
        let type = properties.Type.deep_unpack();
        let technology = this._technologies[type];
        if(!technology)
            return;
        this._services[path].destroy();
        delete this._services[path];
    },

    clear: function() {
        this._technologies = {};
    }
});

/* main applet class handling everything */
const ConnmanApplet = new Lang.Class({
    Name: "ConnmanApplet",
    Extends: PanelMenu.SystemIndicator,

    _init: function() {
        this.parent();

        this._menu = new ConnmanMenu(this._addIndicator.bind(this));
        this.menu.addMenuItem(this._menu);
        this.menu.actor.show();
    },

    _connectEvent: function() {
        this.menu.actor.show();

        this._manager = new ConnmanInterface.ManagerProxy();
        this._manager.RegisterAgentRemote(ConnmanInterface.AGENT_PATH);
        this._asig = this._manager.connectSignal("TechnologyAdded",
                function(proxy, sender, [path, properties]) {
                    this._menu.addTechnology(path, properties);
                }.bind(this));
        this._rsig = this._manager.connectSignal("TechnologyRemoved",
                function(proxy, sender, [path, properties]) {
                    this._menu.removeTechnology(path);
                }.bind(this));
        this._psig = this._manager.connectSignal("PropertyChanged",
                function(proxy, sender, [property, value]) {}.bind(this));
        this._ssig = this._manager.connectSignal("ServicesChanged",
                function(proxy, sender, [changed, removed]) {
                    for each(let [path, properties] in changed)
                        this._menu.updateService(path, properties);
                    for each(let path in removed)
                        this._menu.removeService(path);
                }.bind(this));

        this._manager.GetTechnologiesRemote(function(result, exception) {
            if(!result || exception) {
                return;
            }
            let technologies = result[0];
            for each(let [path, properties] in technologies) {
                this._menu.addTechnology(path, properties);
            }
        }.bind(this));
        this.indicators.show();
    },

    _disconnectEvent: function() {
        this._menu.removeAll();
        this.menu.actor.hide();
        this.indicators.hide();
        if(this._manager) {
            this._manager.disconnectSignal(this._asig);
            this._manager.disconnectSignal(this._rsig);
            this._manager.disconnectSignal(this._ssig);
            this._manager.disconnectSignal(this._psig);
        }
        this._manager = null;
    },

    enable: function() {
        if(!this._watch) {
            this._watch = Gio.DBus.system.watch_name(ConnmanInterface.BUS_NAME,
                    Gio.BusNameWatcherFlags.NONE,
                    function() { return this._connectEvent() }.bind(this),
                    function() { return this._disconnectEvent() }.bind(this));

        }
    },

    disable: function() {
        this.menu.actor.hide();
        this._indicator.hide();
        if(this._watch) {
            Gio.DBus.system.unwatch_name(this._watch);
            this._watch = null;
        }
    },
});
