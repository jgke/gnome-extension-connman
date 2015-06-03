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

var enabled = true;
var logLevel = 4;
var infoEnabled = true;

function logMessage(msg) {
    log("Connman-applet: " + msg);
}

function logError(error) {
    logMessage("ERROR: " + error);
}

function logException(exception, msg) {
    if(msg)
        logMessage("Exception: " + msg);
    logMessage("Exception: " + exception + ": " + exception.stack);
}

function logWarning(error) {
    if(loglevel > 1)
        logMessage("WARNING: " + error);
}

function logInfo(msg) {
    if(logLevel > 2)
        logMessage("INFO: " + msg);
}

function logDebug(msg) {
    if(logLevel > 3)
        logMessage("DEBUG: " + msg);
}
