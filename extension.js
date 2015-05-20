const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

let applet;
let menu = Main.panel.statusArea.aggregateMenu;

function init() {
    applet = new PopupMenu.PopupMenuItem("Connman");
}

function enable() {
    menu.menu.addMenuItem(applet, 3);
}

function disable() {
    menu.menu.box.remove_actor(applet.actor);
}
