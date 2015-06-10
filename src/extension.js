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

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Ext = ExtensionUtils.getCurrentExtension();
const ConnmanApplet = Ext.imports.connmanApplet;

let applet;
let menu = Main.panel.statusArea.aggregateMenu;

function init() {
    applet = new ConnmanApplet.ConnmanApplet();
}

function enable() {
    menu.menu.addMenuItem(applet.menu, 3);
    menu._indicators.insert_child_at_index(applet.indicators, 2);
    applet.enable()
}

function disable() {
    applet.disable()
}