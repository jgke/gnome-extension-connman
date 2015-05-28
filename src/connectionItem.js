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

const ConnectionItem = new Lang.Class({
    Name: 'ConnectionItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,
    Abstract: true,

    _init: function(type, proxy, indicator) {
        this.parent('', true);

        this._properties = {};

        this._proxy = proxy;

        this._connected = true;
        this._connectionSwitch = new PopupMenu.PopupMenuItem("Connect");
        this._connectionSwitch.connect('activate', function() {
            if(this.state == 'idle' || this.state == 'failure')
                this._proxy.ConnectRemote();
            else
                this._proxy.DisconnectRemote();
        }.bind(this));

        this._proxy.connectSignal('PropertyChanged',
                function(proxy, sender, [name, value]) {
                    let obj = {};
                    obj[name] = value;
                    this.update(obj);
                }.bind(this));

        this._indicator = indicator;
        this._indicator.show();
        this.label.text = "Connection";
        this._settings = new PopupMenu.PopupMenuItem("Settings");

        this.menu.addMenuItem(this._connectionSwitch);
        this.menu.addMenuItem(this._settings);
        this.hide();
    },

    update: function(properties) {
        for(let key in properties) {
            let newProperty = properties[key].deep_unpack();
            if(newProperty instanceof Object &&
                    !(newProperty instanceof Array)) {
                if(!this._properties[key])
                    this._properties[key] = {};
                for(let innerKey in newProperty) {
                    this._properties[key][innerKey] =
                        newProperty[innerKey].deep_unpack();
                }
            }
            else {
                this._properties[key] = newProperty;
            }
        }
        if(properties.State)
            this.state = properties.State.deep_unpack();
        if(this.state == 'idle')
            this._connectionSwitch.label.text = "Connect";
        else if(this.state == 'failure')
            this._connectionSwitch.label.text = "Reconnect";
        else
            this._connectionSwitch.label.text = "Disconnect";
        this.setIcon(this.getStatusIcon());
    },

    setIcon: function(iconName) {
        this._indicator.icon_name = iconName;
        this.icon.icon_name = iconName;
    },

    destroy: function() {
        this._indicator.destroy();
        this.parent();
    },

    getIcon: function() {
        return 'network-wired-symbolic';
    },

    getAcquiringIcon: function() {
        return 'network-wired-acquiring-symbolic';
    },

    getStatusIcon: function() {
        switch(this.state) {
        case 'online':
        case 'ready':
            return this.getIcon();
        case 'configuration':
        case 'association':
            return this.getAcquiringIcon();
        case 'disconnect':
        case 'idle':
            return 'network-offline-symbolic';
        case 'failure':
        default:
            return 'network-error-symbolic';
        }
    },

    show: function() {
        this.actor.show();
        this._indicator.show();
    },

    hide: function() {
        this.actor.hide();
        this._indicator.hide();
    }
});

const EthernetItem = new Lang.Class({
    Name: 'EthernetItem',
    Extends: ConnectionItem,

    _init: function(proxy, indicator) {
        this.parent('ethernet', proxy, indicator);
        this.label.text = "Wired Connection";
        this._settings.label.text = "Wired Settings";
        this.show();
    },

    update: function(properties) {
        this.parent(properties);
        if(this._properties['Ethernet']['Interface'])
            this.status.text = this._properties['Ethernet']['Interface'];
    },
});

const WirelessItem = new Lang.Class({
    Name: 'WirelessItem',
    Extends: ConnectionItem,

    _init: function(proxy, indicator) {
        this.parent('wifi', proxy, indicator);
    },

    signalToIcon: function() {
        let value = this._strength;
        if (value > 80)
            return 'excellent';
        if (value > 55)
            return 'good';
        if (value > 30)
            return 'ok';
        if (value > 5)
            return 'weak';
        return 'none';
    },

    update: function(properties) {
        this.parent(properties);
    },

    getAcquiringIcon: function() {
        return 'network-wireless-acquiring-symbolic';
    },

    getIcon: function() {
        return 'network-wireless-signal-' + this.signalToIcon() + '-symbolic';
    },
});

const BluetoothItem = new Lang.Class({
    Name: 'BluetoothItem',
    Extends: ConnectionItem,

    _init: function(proxy, indicator) {
        this.parent('bluetooth', proxy, indicator);
    },

    getAcquiringIcon: function() {
        return 'bluetooth-active-symbolic';
    },

    getIcon: function() {
        return 'bluetooth-active-symbolic';
    }
});

function createItem(type, proxy, indicator) {
    switch(type) {
    case 'ethernet':
        return new EthernetItem(proxy, indicator);
    case 'wifi':
        return new WirelessItem(proxy, indicator);
    case 'bluetooth':
        return new BluetoothItem(proxy, indicator);
    default:
        throw 'tried to create unknown service type ' + type;
    }
}
