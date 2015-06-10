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

const Gettext = imports.gettext.domain('gnome-extension-connman');
const _ = Gettext.gettext;

const Technology = new Lang.Class({
    Name: 'Technology',
    Extends: PopupMenu.PopupMenuSection,
    Abstract: true,

    _init: function(type, proxy) {
        this.parent();
        this._type = type;
        this._services = {}
        this._dialog = null;

        this._proxy = proxy;
        if(this._proxy)
            this._sig = this._proxy.connectSignal('PropertyChanged',
                function(proxy, sender, [name, value]) {
                    Logger.logDebug('Technology ' + this._type + ' property ' +
                        name + ' changed: ' + value.deep_unpack());
                }.bind(this));
    },

    addService: function(id, service) {
        this._services[id] = service;
        service.id = id;
        this.addMenuItem(service);
        this.serviceUpdated(id);
        this.updateIcon();
    },

    getService: function(id) {
        return this._services[id];
    },

    updateService: function(id, properties) {
        if(!this._services[id])
            return false;
        this._services[id].update(properties);
        this.serviceUpdated(id);
        this.updateIcon();
        return true;
    },

    removeService: function(id) {
        if(!this._services[id])
            return false;
        this._services[id].destroy();
        delete this._services[id];
        this.serviceUpdated(id);
        this.updateIcon();
        return true;
    },

    destroy: function() {
        for(let path in this._services) {
            try {
                this.removeService(path);
            } catch(error) {}
        }
        try {
            if(this._proxy)
                this._proxy.disconnectSignal(this._sig);
        } catch(error) {
            Logger.logException(error, 'Failed to disconnect service proxy');
        }
        this.parent();
    },

    serviceUpdated: function(id) {},

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

    _init: function(name, proxy, manager) {
        this.parent('wifi', proxy);

        this._menu = new PopupMenu.PopupSubMenuMenuItem('', true);

        this._menu.label.text = _("Wireless");
        this._menu.status.text = _("Idle");
        this._menu.menu.addMenuItem(this._createConnectionMenuItem());
        //this._menu.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Wireless Settings")));
        this._menu.icon.icon_name = 'network-wireless-signal-none-symbolic';
        this.addMenuItem(this._menu);
        this._manager = manager;
    },

    _createConnectionMenuItem: function() {
        let connectionItem = new PopupMenu.PopupMenuItem(
            _("Select wireless network"));
        connectionItem.connect('activate', this.selectWifi.bind(this));
        return connectionItem;
    },

    selectWifi: function() {
        let serviceList = [];
        let result = this._manager.GetServicesSync();
        let services = result[0];
        for(let i = 0; i < services.length; i++)
            if(this._services[services[i][0]])
                serviceList.push(this._services[services[i][0]]);
        let callback = function(service) {
            this._dialog = null;
            if(service)
                service.buttonEvent();
            else
                Logger.logInfo('User canceled wifi dialog');
        }.bind(this);
        this._dialog = new Service.ServiceChooser(this._proxy,
            serviceList, callback);
    },

    addService: function(id, service) {
        this.parent(id, service);
        service.menu.addMenuItem(this._createConnectionMenuItem());
        if(this._dialog)
            this._dialog.addService(service);
    },

    updateService: function(id, properties) {
        this.parent(id, properties);
        if(this._dialog)
            this._dialog.updateService(this._services[id]);
    },

    removeService: function(id) {
        if(this._services[id]._properties['State'] != 'idle') {
            this._services[id].hide();
            this._menu.actor.show();
            this._service = null;
        }
        this.parent(id);
        this.serviceUpdated(id);
        this.updateIcon();
        if(this._dialog)
            this._dialog.removeService(id);
    },

    serviceUpdated: function(id) {
        this.parent();
        let service = this._services[id];
        if(service) {
            if(service._properties['State'] == 'idle' && service.actor.visible) {
                service.hide();
                this._menu.actor.show();
            } else if(service._properties['State'] != 'idle') {
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

    _init: function(proxy, manager) {
        this.parent('wifi', proxy);
        this._serviceInterfaces = {};
        this._interfaces = {};
        this._manager = manager;
    },

    addService: function(id, service) {
        let intf = service._properties['Ethernet']['Interface'];
        this._serviceInterfaces[id] = intf;
        if(!this._interfaces[intf]) {
            Logger.logDebug('Adding interface ' + intf);
            this._interfaces[intf] = new WirelessInterface(intf, this._proxy,
                this._manager);
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
            Logger.logError('Tried to update nonexisting wifi interface ' + intf);
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

const CellularTechnology = new Lang.Class({
    Name: 'CellularTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('cellular', proxy);
    },
});

const VPNTechnology = new Lang.Class({
    Name: 'VPNTechnology',
    Extends: Technology,

    _init: function(proxy) {
        this.parent('vpn', proxy);
    },
});

function createTechnology(type, proxy, manager) {
    switch(type) {
    case 'ethernet':
        return new EthernetTechnology(proxy);
    case 'wifi':
        return new WirelessTechnology(proxy, manager);
    case 'bluetooth':
        return new BluetoothTechnology(proxy);
    case 'p2p':
        return new P2PTechnology(proxy);
    case 'cellular':
        return new CellularTechnology(proxy);
    case 'vpn':
        return new VPNTechnology(proxy);
    default:
        throw 'tried to add unknown technology type ' + type;
    }
}
