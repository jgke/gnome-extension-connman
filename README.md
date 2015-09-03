gnome-extension-connman
=======================

gnome-shell extension for connman.

![screenshot](https://raw.githubusercontent.com/jgke/jgke.github.io/gnome-extension-connman/screenshot.png)

Dependencies
------------

 * gnome-autogen, available from gnome-common
 * [connman-gtk](https://github.com/jgke/connman-gtk)

If building from git, you also need

 * autoconf
 * intltool

Installation
------------

Recommended way of installing is from [Gnome extension page](https://extensions.gnome.org/extension/981/connman-extension/).

Manual install from git:

	./autogen.sh
	make
	make install

Use 'gnome-tweak-tool' to enable the extension.

License
-------

GPLv2, see COPYING
