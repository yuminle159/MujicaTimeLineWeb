"""Configure Tcl/Tk paths before the bundled GUI imports tkinter."""
import os
import sys


if getattr(sys, "frozen", False):
    bundle_dir = sys._MEIPASS

    def tcl_path(*parts):
        path = os.path.abspath(os.path.join(bundle_dir, *parts))
        # Tcl 8.6 can mis-resolve Windows known folders (notably AppData) when
        # the legacy Shell Folders registry key is absent. The extended path
        # prefix bypasses that name substitution and still works normally on
        # unaffected Windows installations.
        if os.name == "nt":
            return "//?/" + path.replace("\\", "/")
        return path

    os.environ["TCL_LIBRARY"] = tcl_path("tcl", "tcl8.6")
    os.environ["TK_LIBRARY"] = tcl_path("tcl", "tk8.6")
