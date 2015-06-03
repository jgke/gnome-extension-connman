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

const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const Service = Ext.imports.service;
const Logger = Ext.imports.logger;

const Technology = new Lang.Class({
    Name: 'Technology',
    Extends: PopupMenu.PopupMenuSection,
    Abstract: true,

    _init: function(type, proxy) {
        this.parent();
        this._type = type;
        this._services = {}

        this._proxy = proxy;
        this._sig = this._proxy.connectSignal('PropertyChanged',
                function(proxy, sender, [name, value]) {
                    Logger.logDebug("Technology " + this._type + " property " +
                            name + " changed: " + value.deep_unpack());
                }.bind(this));
    },

    addService: function(id, service) {
        this._services[id] = service;
        this.addMenuItem(service);
        this.updateIcon();
    },

    getService: function(id) {
        return this._services[id];
    },

    updateService: function(id, properties) {
        if(!this._services[id])
            return false;
        this._services[id].update(properties);
        this.updateIcon();
        return true;
    },

    removeService: function(id) {
        if(!this._services[id])
            return false;
        this._services[id].destroy();
        delete this._services[id];
        this.updateIcon();
        return true;
    },

    destroy: function() {
        for(let path in this._services) {
            try {
                this.removeService(path);
            }
            catch(error) {}
        }
        try {
            if(this._proxy)
                this._proxy.disconnectSignal(this._sig);
        }
        catch(error) {
            Logger.logException(error, "Failed to disconnect service proxy");
        }
        this.parent();
    },

    updateIcon: function() {
        if(Object.keys(this._services)) {
            this._indicator = this._services[Object.keys(this._services)[0]];
            for(let path in this._services) {
                let state = this._services[path]._properties['State'];
                if(state != 'idle')
                    this._indicator = this._services[path]._indicator;
            }
            for(let path in this._services) {
                let state = this._services[path]._properties['State'];
                if(state != 'idle' && state != 'failure')
                    this._indicator = this._services[path]._indicator;
            }
        }
    }
});

const EthernetTechnology = new Lang.Class({
    Name: 'EthernetTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('ethernet', proxy);
    },
});

const WirelessInterface = new Lang.Class({
    Name: 'WirelessInterface',
    Extends: Technology,

    _init: function(name, proxy) {
        this.parent('wifi', proxy);

        this._menu = new PopupMenu.PopupSubMenuMenuItem('', true);

        this._menu.label.text = "Wireless";
        this._menu.status.text = "idle";
        this._connectionSwitch = new PopupMenu.PopupMenuItem("Connect");
        this._connectionSwitch.connect('activate', function() {
            new Service.ServiceChooser(Object.keys(this._services).map(function(key) {
                return this._services[key];
            }.bind(this)).filter(function(service) {
                return service._properties["Name"] && service._properties["Name"].length;
            }), function(service) {
                service.buttonEvent();
            });
        }.bind(this));
        this._menu.menu.addMenuItem(this._connectionSwitch);
        this._menu.menu.addMenuItem(new PopupMenu.PopupMenuItem("Wireless Settings"));
        this._menu.icon.icon_name = 'network-offline-symbolic';
        this.addMenuItem(this._menu);
    },

    removeService: function(id) {
        if(this._services[id]._properties['State'] != 'idle') {
            this._services[id].hide();
            this._menu.actor.show();
            this._service = null;
        }
        this.parent(id);
        this.update(id);
        this.updateIcon();
    },

    update: function(id) {
        let service = this._services[id];
        if(service) {
            if(service._properties['State'] == 'idle' && service.actor.visible) {
                service.hide();
                this._menu.actor.show();
            }
            else if (service._properties['State'] != 'idle') {
                this._menu.actor.hide();
                service.show();
            }
        }
        this.updateIcon();
    },

    destroy: function() {
        this._proxy = null;
        this.parent();
    }
});

const WirelessTechnology = new Lang.Class({
    Name: 'WirelessTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('wifi', proxy);
        this._serviceInterfaces = {};
        this._interfaces = {};
    },

    addService: function(id, service) {
        let intf = service._properties['Ethernet']['Interface'];
        this._serviceInterfaces[id] = intf;
        if(!this._interfaces[intf]) {
            Logger.logDebug("Adding interface " + intf);
            this._interfaces[intf] = new WirelessInterface(intf, this._proxy);
            this.addMenuItem(this._interfaces[intf]);
        }
        this._interfaces[intf].addService(id, service);
    },

    getService: function(id) {
        let intf = this._serviceInterfaces[id];
        if(!intf)
            return null;
        return this._interfaces[intf].getService(id);
    },

    updateService: function(id, properties) {
        let intf = this._serviceInterfaces[id];
        if(!this._interfaces[intf]) {
            Logger.logError("Tried to update nonexisting wifi interface " + intf);
        }
        this._interfaces[intf].updateService(id, properties);
    },

    removeService: function(id) {
        let intf = this._serviceInterfaces[id];
        this._interfaces[intf].removeService(id);
    },

    destroy: function() {
        for(let intf in this._interfaces)
            this._interfaces[intf].destroy();
        this.parent();
    }
});

const BluetoothTechnology = new Lang.Class({
    Name: 'BluetoothTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('bluetooth', proxy);
    },
});

const P2PTechnology = new Lang.Class({
    Name: 'P2PTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('p2p', proxy);
    },
});

function createTechnology(type, proxy) {
    switch(type) {
    case 'ethernet':
        return new EthernetTechnology(proxy);
    case 'wifi':
        return new WirelessTechnology(proxy);
    case 'bluetooth':
        return new BluetoothTechnology(proxy);
    case 'p2p':
        return new P2PTechnology(proxy);
    default:
        throw 'tried to add unknown technology type ' + type;
    }
}
