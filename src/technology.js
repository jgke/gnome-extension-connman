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

const Technology = new Lang.Class({
    Name: 'Technology',
    Extends: PopupMenu.PopupMenuSection,

    _init: function(type) {
        this.parent();
        this._type = type;
        this._services = {}
    },

    addService: function(id, service) {
        this._services[id] = service;
    },

    updateService: function(id, properties) {
        if(!this._services[id])
            return false;
        this._services[id].update(properties);
        return true;
    },

    removeService: function(id) {
        if(!this._services[id])
            return false;
        this._services[id].destroy();
        delete this._services[id];
        return true;
    },

    destroy: function() {
        for(path in this._services)
            this._services[path].destroy();
        this.parent();
    },
});

const EthernetTechnology = new Lang.Class({
    Name: 'EthernetTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('ethernet');
    },

    addService: function(id, service) {
        this.parent(id, service);
        this.addMenuItem(service);
    }
});

const WirelessInterface = new Lang.Class({
    Name: 'WirelessInterface',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function(name) {
        this.parent('', true);
        this.label.text = "Wireless Connection";
        this.status.text = name;
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Connect"));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Wireless Settings"));
        this.icon.icon_name = 'network-wireless-signal-excellent-symbolic';
    },
});

const WirelessTechnology = new Lang.Class({
    Name: 'WirelessTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('wifi');
        this._interfaces = {};
    },

    addService: function(id, service) {
        this.parent(id, service);
        let intf = service._properties["Ethernet"]["Interface"];
        if(!this._interfaces[intf]) {
            this._interfaces[intf] = new WirelessInterface(intf);
            this.addMenuItem(this._interfaces[intf]);
        }
    }
});

const BluetoothTechnology = new Lang.Class({
    Name: 'BluetoothTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('bluetooth');
    },
});

function createTechnology(type) {
    switch(type) {
    case 'ethernet':
        return new EthernetTechnology();
    case 'wifi':
        return new WirelessTechnology();
    case 'bluetooth':
        return new BluetoothTechnology();
    default:
        return new Technology(type);
    }
}
