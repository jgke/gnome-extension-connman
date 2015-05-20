const Lang = imports.lang;

const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ConnmanApplet = new Lang.Class({
    Name: "ConnmanApplet",
    Extends: PanelMenu.SystemIndicator,

    _init: function() {
        this.parent();

        this._indicator = this._addIndicator();
        this._indicator.icon_name = "network-wired-symbolic";
        this._indicator.show();

        this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Connman"));
    },
});
