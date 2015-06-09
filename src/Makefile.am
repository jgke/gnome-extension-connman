# Change these to modify how installation is performed
extensionurl = git://github.com/jgke/gnome-extension-connman.git
topextensiondir = $(datadir)/gnome-shell/extensions
extensiondir = $(topextensiondir)/$(uuid)
uuid = gnome-extension-connman@jaakko.hannikainen.intel.com


dist_extension_DATA = metadata.json Makefile connmanAgent.js \
		      connmanInterface.js Makefile.am service.js technology.js \
		      connmanApplet.js extension.js logger.js
nodist_extension_DATA = metadata.json $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(datadir)/locale|" \
	    -e "s|[@]uuid@|$(uuid)|" $< > $@

CLEANFILES = metadata.json
