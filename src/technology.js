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
    Abstract: true,

    _init: function(type) {
        this.parent();
        this._type = type;
        this._services = {}
    },

    addService: function(id, service) {
        this._services[id] = service;
        this.addMenuItem(service);
        this.updateIcon();
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
        for(path in this._services)
            this._services[path].destroy();
        this.parent();
    },

    updateIcon: function() {
        if(this._services[Object.keys(this._services)[0]]) {
            this._indicator = this._services[Object.keys(this._services)[0]];
            for(let path in this._services) {
                let state = this._services[path]._properties['State'];
                if(state != 'idle')
                    this._indicator = this._services[path]._indicator;
            }
            for(let path in this._services) {
                let state = this._services[path]._properties['State'];
                if(state != 'failure')
                    this._indicator = this._services[path]._indicator;
            }
        }
    }
});

const EthernetTechnology = new Lang.Class({
    Name: 'EthernetTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('ethernet');
    },
});

const WirelessInterface = new Lang.Class({
    Name: 'WirelessInterface',
    Extends: Technology,

    _init: function(name) {
        this.parent('wifi');

        this._menu = new PopupMenu.PopupSubMenuMenuItem('', true);

        this._menu.label.text = "Wireless Connection";
        this._menu.status.text = name;
        this._menu.menu.addMenuItem(new PopupMenu.PopupMenuItem("Connect"));
        this._menu.menu.addMenuItem(new PopupMenu.PopupMenuItem("Wireless Settings"));
        this._menu.icon.icon_name = 'network-wireless-signal-excellent-symbolic';
        this.addMenuItem(this._menu);
    },

    addService: function(id, service) {
        this.parent(id, service);
        this.update(id);
        this.updateIcon();
    },

    updateService: function(id, properties) {
        this.parent(id, properties);
        this.update(id);
        this.updateIcon();
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
        let intf = service._properties['Ethernet']['Interface'];
        if(!this._interfaces[intf]) {
            this._interfaces[intf] = new WirelessInterface(intf);
            this.addMenuItem(this._interfaces[intf]);
        }
        this._interfaces[intf].addService(id, service);
    },

    updateService: function(id, properties) {
        this.parent(id, properties);
        let intf = this._services[id]._properties['Ethernet']['Interface'];
        this._interfaces[intf].updateService(id, properties);
    },

    removeService: function(id) {
        this.parent(id);
        let intf = this._services[id]._properties['Ethernet']['Interface'];
        this._interfaces[intf].removeService(id);
    }
});

const BluetoothTechnology = new Lang.Class({
    Name: 'BluetoothTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('bluetooth');
    },
});

const P2PTechnology = new Lang.Class({
    Name: 'P2PTechnology',
    Extends: Technology,

    _init: function() {
        this.parent('p2p');
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
    case 'p2p':
        return new P2PTechnology();
    default:
        throw 'tried to add unknown technology type ' + type;
    }
}
