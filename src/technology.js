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
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const Service = Ext.imports.service;
const Logger = Ext.imports.logger;

const Gettext = imports.gettext.domain('gnome-extension-connman');
const _ = Gettext.gettext;

const Version = Ext.imports.version;
const version = Version.version();

var Technology = class extends PopupMenu.PopupMenuSection {

    constructor(properties, type, proxy) {
        super();
        this._type = type;
        this._services = {}
        this._dialog = null;
        this._properties = properties;

        this._proxy = proxy;
        if (this._proxy)
            this._sig = this._proxy.connectSignal('PropertyChanged',
                function(proxy, sender, [name, value]) {
                    this.propertyChanged(name, value.deep_unpack());
                }.bind(this));
        if (this._properties['Powered'])
            this.show();
        else
            this.hide();
    }

    getValue() {
        let values = ["ethernet", "wifi", "bluetooth",
                      "p2p", "cellular", "vpn", "other"];
        return values.indexOf(this._type);
    }

    propertyChanged(name, value) {
        if(name == 'Powered') {
            if(value)
                this.show();
            else
                this.hide();
        }
    }

    addService(id, service) {
        if(this._services[id])
            this._services[id].destroy();
        this._services[id] = service;
        service.id = id;
        this.addMenuItem(service);
        this.serviceUpdated(id);
        this.updateIcon();
    }

    getService(id) {
        return this._services[id];
    }

    updateService(id, properties) {
        if(!this._services[id])
            return false;
        this._services[id].update(properties);
        this.serviceUpdated(id);
        this.updateIcon();
        return true;
    }

    removeService(id) {
        if(!this._services[id])
            return false;
        this._services[id].destroy();
        delete this._services[id];
        this.serviceUpdated(id);
        this.updateIcon();
        return true;
    }

    destroy() {
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
        super.destroy();
    }

    serviceUpdated(id) {}

    updateIcon() {
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

    show() {
        this.actor.show();
        if(this._indicator)
            this._indicator.show();
    }

    hide() {
        this.actor.hide();
        if(this._indicator)
            this._indicator.hide();
    }
};

var EthernetTechnology = class extends Technology {

    constructor(properties, proxy) {
        super(properties, 'ethernet', proxy);
    }
};

var WirelessTechnology = class extends Technology {

    constructor(properties, proxy, manager) {
        super(properties, 'wifi', proxy);

        this._menu = new PopupMenu.PopupSubMenuMenuItem('', true);

        this._settings = new PopupMenu.PopupMenuItem(_("Wireless Settings"));
        this._settings.connect('activate', this.openSettings.bind(this));

        if (version < 318) {
            this._menu.label.text = _("Wireless");
            this._menu.status.text = _("Idle");
        } else {
            this._menu.label.text = _("Wireless") + " - " + _("Idle");
        }
        this._menu.icon.icon_name = 'network-wireless-signal-none-symbolic';
        this._manager = manager;
        this.addMenuItem(this._menu);
        this._menu.menu.addMenuItem(this._createConnectionMenuItem());
        this._menu.menu.addMenuItem(this._settings);
        this._connected = {};
        this._connectedCount = 0;
        this.show();
    }

    openSettings() {
        Util.spawnApp(['connman-gtk', '--page', 'wifi']);
    }

    _createConnectionMenuItem() {
        let connectionItem = new PopupMenu.PopupMenuItem(
            _("Select wireless network"));
        connectionItem.connect('activate', this.selectWifi.bind(this));
        return connectionItem;
    }

    selectWifi() {
        let serviceList = [];
        let result = this._manager.GetServicesSync();
        let services = result[0];
        for(let i = 0; i < services.length; i++) {
            let service = this._services[services[i][0]];
            if(service && service._properties['Name'])
                serviceList.push([service, service._properties['Ethernet']['Interface']]);
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
    }

    addService(id, service) {
        super.addService(id, service);
        service.menu.addMenuItem(this._createConnectionMenuItem(), 1);
        let state = this._services[id].state;
        if(state != 'idle' && state != 'disconnect' && state != 'failure') {
            this._connected[id] = true;
            this._menu.actor.hide();
            this._connectedCount++;
        }
        if(this._dialog)
            this._dialog.addService([service, service._properties['Ethernet']['Interface']]);
    }

    updateService(id, properties) {
        super.updateService(id, properties);
        let state = this._services[id]._properties['State'];
        if(state != 'idle' && state != 'disconnect' && state != 'failure') {
            if(!this._connected[id]) {
                this._connected[id] = true;
                this._connectedCount++;
                this._menu.actor.hide();
            }
        }
        else {
            if(this._connected[id]) {
                this._connected[id] = false;
                this._connectedCount--;
                if(!this._connectedCount)
                    this._menu.actor.show();
            }
        }
        if(this._dialog)
            this._dialog.updateService([this._services[id],
                this._services[id]._properties['Ethernet']['Interface']]);
    }

    removeService(id) {
        let state = this._services[id]._properties['State'];
        if(state != 'idle' && state != 'disconnect' && state != 'failure') {
            this._services[id].hide();
            if(this._connected[id]) {
                this._connected[id] = false;
                this._connectedCount--;
                if(!this._connectedCount)
                    this._menu.actor.show();
            }
        }
        super.removeService(id);
        this.serviceUpdated(id);
        this.updateIcon();
        if(this._dialog)
            this._dialog.removeService(id);
    }

    destroy() {
        this._proxy = null;
        super.destroy();
    }
};

var BluetoothTechnology = class extends Technology {

    constructor(properties, proxy) {
        super(properties, 'bluetooth', proxy);
    }
};

var P2PTechnology = class extends Technology {

    constructor(properties, proxy) {
        super(properties, 'p2p', proxy);
    }
};

var CellularTechnology = class extends Technology {

    constructor(properties, proxy) {
        super(properties, 'cellular', proxy);
    }
};

class VPNTechnology extends Technology {

    constructor(properties, proxy) {
        super(properties, 'vpn', proxy);
    }
};

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
    return new Technology(properties, 'other', proxy);
}
