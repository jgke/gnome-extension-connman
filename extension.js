const Lang = imports.lang;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

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
    menu.menu.box.remove_actor(applet.menu.actor);
    applet.disable()
}
