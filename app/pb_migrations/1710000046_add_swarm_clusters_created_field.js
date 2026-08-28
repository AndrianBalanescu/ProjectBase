// Migration 46: Add created and updated autodate fields to swarm_clusters collection

migrate((app) => {
    try {
        const col = app.findCollectionByNameOrId("swarm_clusters");
        if (col) {
            let changed = false;
            try {
                if (!col.fields.getByName("created")) {
                    col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
                    changed = true;
                }
            } catch (e) {
                col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
                changed = true;
            }
            try {
                if (!col.fields.getByName("updated")) {
                    col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
                    changed = true;
                }
            } catch (e) {
                col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
                changed = true;
            }
            if (changed) {
                app.save(col);
            }
        }
    } catch (err) {
        console.log("Error updating swarm_clusters schema: " + err);
    }
}, (app) => {
});
