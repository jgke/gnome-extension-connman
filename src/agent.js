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

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Pango = imports.gi.Pango;

const ModalDialog = imports.ui.modalDialog;
const ShellEntry = imports.ui.shellEntry;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const Interface = Ext.imports.interface;
const Logger = Ext.imports.logger;

const Gettext = imports.gettext.domain('gnome-extension-connman');
const _ = Gettext.gettext;

const DialogField = new Lang.Class({
    Name: 'DialogField',

    _init: function(label) {
        this.addLabel(label);
        this.addEntry();
    },

    addLabel: function(label) {
        this.label = new St.Label({
            style_class: 'cm-prompt-dialog-password-label',
            text: label,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    },

    addEntry: function() {
        this.entry = new St.Entry({
            style_class: 'cm-prompt-dialog-password-entry',
            can_focus: true,
            reactive: true,
            x_expand: true
        });
        ShellEntry.addContextMenu(this.entry, {
            isPassword: true
        });
        this.entry.clutter_text.set_password_char('\u25cf');
    },

    getLabel: function() {
        return this.label.text;
    },

    getValue: function() {
        return this.entry.get_text();
    },

    valid: function() {
        return true;
    }
});

const Dialog = new Lang.Class({
    Name: 'Dialog',
    Extends: ModalDialog.ModalDialog,

    _init: function(fields, callback) {
        this.parent({
            styleClass: 'cm-prompt-dialog'
        });
        this._fields = [];
        this._callback = callback;
        let mainContentBox = new St.BoxLayout({
            style_class: 'cm-prompt-dialog-main-layout',
            vertical: false
        });
        let icon = new St.Icon({
            icon_name: 'dialog-password-symbolic'
        });
        let messageBox = new St.BoxLayout({
            style_class: 'cm-prompt-dialog-message-layout',
            vertical: true,
            x_expand: true
        });
        let subjectLabel = new St.Label({
            style_class: 'cm-prompt-dialog-headline headline',
            text: _("Authentication required by network connection")
        });

        mainContentBox.add(icon, {
            x_fill: true,
            y_fill: true,
            x_align: St.Align.END,
            y_align: St.Align.START
        });
        mainContentBox.add(messageBox, {
            y_align: St.Align.START
        });
        messageBox.add(subjectLabel, {
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START
        });

        this.contentLayout.add(mainContentBox, {
            x_fill: true,
            y_fill: true
        });

        let layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL
        });
        let secretTable = new St.Widget({
            style_class: 'cm-network-dialog-secret-table',
            layout_manager: layout
        });
        layout.hookup_style(secretTable);
        for(let i = 0; i < fields.length; i++) {
            let field = fields[i];
            layout.attach(field.label, 0, i, 1, 1);
            layout.attach(field.entry, 1, i, 1, 1);
            this._fields[i] = field;
        }
        messageBox.add(secretTable);

        this._okButton = {
            label: _("Connect"),
            action: this._onOk.bind(this),
            default: true
        };
        this._cancelButton = {
            label: _("Cancel"),
            action: this._onCancel.bind(this),
            key: Clutter.KEY_Escape
        };
        this.setButtons([this._cancelButton, this._okButton]);
        this.open();
    },

    _onOk: function() {
        this.close();
        if(!this._fields.reduce(function(a, b) {
                return a && b.valid()
            }, true))
            return;
        let values = {};
        Object.keys(this._fields).map(function(key) {
            values[this._fields[key].getLabel()] = this._fields[key].getValue();
        }.bind(this));
        this._callback(values);
    },

    _onCancel: function() {
        this.close();
        this._callback();
    }
});

const AbstractAgent = new Lang.Class({
    Name: 'AbstractAgent',

    _init: function() {},

    Release: function() {
        this.destroy();
    },

    ReportErrorAsync: function([service, error], invocation) {
        Logger.logDebug('Service reported error: ' + error);
        invocation.return_dbus_error(this._retryError, '');
    },

    RequestInputAsync: function([service, fields], invocation) {
        Logger.logDebug('Requested password');
        let fields = Object.keys(fields)
            .map(function(key) {
                fields[key] = fields[key].deep_unpack();
                Object.keys(fields[key]).map(function(innerKey) {
                    fields[key][innerKey] = fields[key][innerKey].deep_unpack();
                });
                return [key, fields[key]];
            });
        let dialogFields = [];
        for(let i = 0; i < fields.length; i++)
            if(fields[i][1]['Requirement'] == 'mandatory')
                dialogFields.push(new DialogField(fields[i][0]));

        let callback = function(fields) {
            if(!fields) {
                invocation.return_dbus_error(this._canceledError,
                    'User canceled password dialog');
                return;
            }
            Object.keys(fields).map(function(key) {
                fields[key] = GLib.Variant.new('s', fields[key]);
            });
            invocation.return_value(GLib.Variant.new('(a{sv})', [fields]));
        }.bind(this);
        this._dialog = new Dialog(dialogFields, callback);
    },

    Cancel: function(params, invocation) {
        Logger.logDebug('Password dialog canceled');
        this._dialog._onCancel();
        this._dialog = null;
    },

    destroy: function() {
        if(this._dialog)
            this._dialog._onCancel();
        this._dialog = null;
    }
});

const Agent = new Lang.Class({
    Name: 'Agent',
    Extends: AbstractAgent,

    _init: function() {
        this._dbusImpl = Interface.addAgentImplementation(this);
        this._canceledError = 'net.connman.Agent.Error.Canceled';
        this._retryError = 'net.connman.Agent.Error.Retry';
    },

    RequestBrowser: function(service, url) {
        Logger.logDebug('Requested browser');
    },

    destroy: function() {
        this.parent();
        Interface.removeAgentImplementation(this._dbusImpl);
    },
});

const VPNAgent = new Lang.Class({
    Name: 'VPNAgent',
    Extends: AbstractAgent,

    _init: function() {
        this._dbusImpl = Interface.addVPNAgentImplementation(this);
        this._canceledError = 'net.connman.vpn.Agent.Error.Canceled';
        this._retryError = 'net.connman.vpn.Agent.Error.Retry';
    },

    destroy: function() {
        this.parent();
        Interface.removeVPNAgentImplementation(this._dbusImpl);
    },
});
