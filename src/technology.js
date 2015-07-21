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
const Util = imports.misc.util;

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

    _init: function(properties, type, proxy) {
        this.parent();
        this._type = type;
        this._services = {}
        this._dialog = null;
        this._properties = properties;

        this._proxy = proxy;
        if(this._proxy)
            this._sig = this._proxy.connectSignal('PropertyChanged',
                function(proxy, sender, [name, value]) {
                    this.propertyChanged(name, value.deep_unpack());
                }.bind(this));
        if(this._properties["Powered"])
            this.show();
        else
            this.hide();
    },

    propertyChanged: function(name, value) {
        if(name == "Powered") {
            if(value)
                this.show();
            else
                this.hide();
        }
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
    },

    show: function() {
        this.actor.show();
        if(this._indicator)
            this._indicator.show();
    },

    hide: function() {
        this.actor.hide();
        if(this._indicator)
            this._indicator.hide();
    }
});

const EthernetTechnology = new Lang.Class({
    Name: 'EthernetTechnology',
    Extends: Technology,

    _init: function(properties, proxy) {
        this.parent(properties, 'ethernet', proxy);
    },
});

const WirelessTechnology = new Lang.Class({
    Name: 'WirelessTechnology',
    Extends: Technology,

    _init: function(properties, proxy, manager) {
        this.parent(properties, 'wifi', proxy);

        this._menu = new PopupMenu.PopupSubMenuMenuItem('', true);

        this._settings = new PopupMenu.PopupMenuItem(_("Wireless Settings"));
        this._settings.connect('activate', this.openSettings.bind(this));

        this._menu.label.text = _("Wireless");
        this._menu.status.text = _("Idle");
        this._menu.icon.icon_name = 'network-wireless-signal-none-symbolic';
        this._manager = manager;
        this.addMenuItem(this._menu);
        this._menu.menu.addMenuItem(this._createConnectionMenuItem());
        this._menu.menu.addMenuItem(this._settings);
        if(this._properties["Connected"])
            this._menu.menu.actor.hide();
        else
            this._menu.menu.actor.show();
    },

    propertyChanged: function(name, value) {
        this.parent(name, value);
        if(name == "Connected") {
            if(value)
                this._menu.menu.hide();
            else
                this._menu.menu.show();
        }
    },

    openSettings: function() {
        Util.spawnApp(['connman-gtk', '--page', 'wifi']);
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
        for(let i = 0; i < services.length; i++) {
            let service = this._services[services[i][0]];
            if(service && service._properties["Name"])
                serviceList.push([service, service._properties["Ethernet"]["Interface"]]);
        }
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
        if(this._services[id]._properties['State'] != 'idle')
            this._services[id].show();
        if(this._dialog)
            this._dialog.addService([service, service._properties["Ethernet"]["Interface"]]);
    },

    updateService: function(id, properties) {
        this.parent(id, properties);
        if(this._services[id]._properties['State'] != 'idle')
            this._services[id].show();
        else
            this._services[id].hide();
        if(this._dialog)
            this._dialog.updateService([this._services[id],
                this._services[id]._properties["Ethernet"]["Interface"]]);
    },

    removeService: function(id) {
        if(this._services[id]._properties['State'] != 'idle')
            this._services[id].hide();
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
            if(service._properties['State'] == 'idle' && service.actor.visible)
                service.hide();
            else if(service._properties['State'] != 'idle')
                this._menu.actor.hide();
        }
        this.updateIcon();
    },

    destroy: function() {
        this._proxy = null;
        this.parent();
    }
});

const BluetoothTechnology = new Lang.Class({
    Name: 'BluetoothTechnology',
    Extends: Technology,

    _init: function(properties, proxy) {
        this.parent(properties, 'bluetooth', proxy);
    },
});

const P2PTechnology = new Lang.Class({
    Name: 'P2PTechnology',
    Extends: Technology,

    _init: function(properties, proxy) {
        this.parent(properties, 'p2p', proxy);
    },
});

const CellularTechnology = new Lang.Class({
    Name: 'CellularTechnology',
    Extends: Technology,

    _init: function(properties, proxy) {
        this.parent(properties, 'cellular', proxy);
    },
});

const VPNTechnology = new Lang.Class({
    Name: 'VPNTechnology',
    Extends: Technology,

    _init: function(properties, proxy) {
        this.parent(properties, 'vpn', proxy);
    },
});

function createTechnology(type, properties, proxy, manager) {
    let technologies = {
        ethernet: EthernetTechnology,
        wifi: WirelessTechnology,
        bluetooth: BluetoothTechnology,
        p2p: P2PTechnology,
        cellular: CellularTechnology,
        vpn: VPNTechnology
    };
    if(technologies[type])
        return new technologies[type](properties, proxy, manager);
    throw 'tried to add unknown technology type ' + type;
}
