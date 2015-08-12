ACLOCAL_AMFLAGS = -I m4 ${ACLOCAL_FLAGS}

.PHONY: zip

SUBDIRS = src po

# This target is adapted from gnome-shell-extension-openweather's Makefile.am
# https://github.com/jenslody/gnome-shell-extension-openweather
zip: src po
	rm -rf $(builddir)/_zip_build
	rm -f "$(builddir)/@UUID@.shell-extension.zip"
	mkdir -p $(builddir)/_zip_build; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_zip_build"; \
	(cd "$(builddir)/_zip_build$(datadir)/gnome-shell/extensions/@UUID@/"; \
	 zip -qr "$(abs_builddir)/@UUID@.shell-extension.zip" .; \
	); \
	rm -rf $(builddir)/_zip_build
