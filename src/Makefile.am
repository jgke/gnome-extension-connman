# Change these to modify how installation is performed
uuid = @UUID@
extensiondir = $(datadir)/gnome-shell/extensions/$(uuid)

dist_extension_DATA = metadata.json Makefile agent.js \
		      interface.js Makefile.am service.js technology.js \
		      applet.js extension.js logger.js stylesheet.css
nodist_extension_DATA = metadata.json $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(datadir)/locale|" \
	    -e "s|[@]uuid@|$(uuid)|" $< > $@

CLEANFILES = metadata.json
