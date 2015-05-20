FILES=extension.js connmanApplet.js metadata.json
PREFIX=~/.local/share/
PATH=gnome-shell/extensions/ConnmanApplet@jaakko.hannikainen.intel.com

install:
	/usr/bin/mkdir -p ${PREFIX}${PATH}
	/usr/bin/cp ${FILES} ${PREFIX}${PATH}
