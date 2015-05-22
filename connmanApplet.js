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
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const ConnmanInterface = Ext.imports.connmanInterface;

const Technology = new Lang.Class({
    Name: "Technology",
    Extends: PopupMenu.PopupMenuSection,

    _init: function(icon, name) {
        this.parent();
        this._menu = new PopupMenu.PopupSubMenuMenuItem(name, true);
        this._menu.icon.icon_name = icon;
        this._menu.status.text = "Status";
        this._menu.menu.addMenuItem(new PopupMenu.PopupMenuItem("Connman"));
        this.addMenuItem(this._menu);
    }
});

/* menu with technologies */
const ConnmanMenu = new Lang.Class({
    Name: "ConnmanMenu",
    Extends: PopupMenu.PopupMenuSection,

    _init: function() {
        this.parent();
        this._technologies = {};
    },

    hide: function() {
        this._menu.actor.hide();
    },

    show: function() {
        this._menu.actor.show();
    },

    addTechnology: function(path, properties) {
        if(this._technologies[path])
            return;
        this._technologies[path] = new Technology('network-wired-symbolic', properties.Name.deep_unpack());
        this.addMenuItem(this._technologies[path]);
    },

    removeTechnology: function(path) {
        let technology = this._technologies[path];
        if(!technology)
            return;
        technology.destroy();
        delete this._technologies[path];
        /* FIXME: for some reason destroying the technology
         * leaves a hole, but for some reason this fixes it */
        this.addMenuItem(new PopupMenu.PopupMenuItem("Connman"), 0);
        this.firstMenuItem.destroy();
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

        this._indicator = this._addIndicator();
        this._indicator.icon_name = "network-wired-symbolic";

        this._menu = new ConnmanMenu();
        this.menu.addMenuItem(this._menu);
    },

    _connectEvent: function() {
        this.menu.actor.show();
        this._indicator.show();

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

        this._manager.GetTechnologiesRemote(function(result, exception) {
            if(!result || exception) {
                return;
            }
            let technologies = result[0];
            for each(let [path, properties] in technologies) {
                this._menu.addTechnology(path, properties);
            }
        }.bind(this));
    },

    _disconnectEvent: function() {
        this._menu.removeAll();
        this.menu.actor.hide();
        this._indicator.hide();
        if(this._manager) {
            this._manager.disconnectSignal(this._asig);
            this._manager.disconnectSignal(this._rsig);
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
