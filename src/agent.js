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
const GObject = imports.gi.GObject;

const ModalDialog = imports.ui.modalDialog;
const ShellEntry = imports.ui.shellEntry;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const Interface = Ext.imports.interface;
const Logger = Ext.imports.logger;

const Gettext = imports.gettext.domain('gnome-extension-connman');
const _ = Gettext.gettext;

var DialogField = class DialogField {

    constructor(label) {
        this.addLabel(label);
        this.addEntry();
    }

    addLabel(label) {
        this.label = new St.Label({
            style_class: 'cm-prompt-dialog-password-label',
            text: label,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    }

    addEntry() {
        this.entry = new St.PasswordEntry({
            style_class: 'cm-prompt-dialog-password-entry',
            can_focus: true,
            reactive: true,
            x_expand: true
        });
        ShellEntry.addContextMenu(this.entry);
        this.entry.clutter_text.set_password_char('\u25cf');
    }

    getLabel() {
        return this.label.text;
    }

    getValue() {
        return this.entry.get_text();
    }

    valid() {
        return true;
    }
};

var Dialog = GObject.registerClass(class Dialog extends ModalDialog.ModalDialog {

    _init(fields, callback) {
        super._init({
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
            text: _("Connection requires authentication")
        });

        icon.x_fill = true;
        icon.y_fill = true;
        icon.x_align = St.Align.END;
        icon.y_align = St.Align.START;
        messageBox.y_align = true;

        mainContentBox.add_child(icon);
        mainContentBox.add_child(messageBox);

        subjectLabel.x_fill = true;
        subjectLabel.y_fill = false;
        subjectLabel.y_align = St.Align.START;

        messageBox.add_child(subjectLabel);

        mainContentBox.x_fill = true;
        mainContentBox.y_fill = true;

        this.contentLayout.add_child(mainContentBox);

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
    }

    _onOk() {
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
    }

    _onCancel() {
        this.close();
        this._callback();
    }
});

var AbstractAgent = class AbstractAgent {

    constructor() {
    }

    Release() {
        this.destroy();
    }

    ReportErrorAsync([service, error], invocation) {
        Logger.logDebug('Service reported error: ' + error);
        invocation.return_dbus_error(this._retryError, '');
    }

    RequestInputAsync([service, _fields], invocation) {
        Logger.logDebug('Requested password');
        var fields = _fields;
        fields = Object.keys(_fields)
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
    }

    Cancel(params, invocation) {
        Logger.logDebug('Password dialog canceled');
        this._dialog._onCancel();
        this._dialog = null;
    }

    destroy() {
        if(this._dialog)
            this._dialog._onCancel();
        this._dialog = null;
    }
};

var Agent = class Agent extends AbstractAgent {

    constructor() {
        super();
        this._dbusImpl = Interface.addAgentImplementation(this);
        this._canceledError = 'net.connman.Agent.Error.Canceled';
        this._retryError = 'net.connman.Agent.Error.Retry';
    }

    RequestBrowser(service, url) {
        Logger.logDebug('Requested browser');
    }

    destroy() {
        super.destroy();
        Interface.removeAgentImplementation(this._dbusImpl);
    }
};

var VPNAgent = class VPNAgent extends AbstractAgent {

    constructor() {
        super();
        this._dbusImpl = Interface.addVPNAgentImplementation(this);
        this._canceledError = 'net.connman.vpn.Agent.Error.Canceled';
        this._retryError = 'net.connman.vpn.Agent.Error.Retry';
    }

    destroy() {
        super.destroy();
        Interface.removeVPNAgentImplementation(this._dbusImpl);
    }
};
