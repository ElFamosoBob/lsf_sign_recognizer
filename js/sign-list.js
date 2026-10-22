// =======================================================================
//  PANNEAU "GESTES RECONNUS"
//  Construit à partir du catalogue de signs.js, et met en évidence les signes détectés.
// =======================================================================

const GROUP_TITLES = {
    static: "Formes de main",
    "two-hands": "À deux mains"
};

export class SignList {

    constructor(container, signs) {
        this.items = new Map();

        for (const [kind, title] of Object.entries(GROUP_TITLES)) {
            const group = signs.filter(sign => sign.kind === kind);
            if (group.length === 0) continue;

            const heading = document.createElement("h3");
            heading.textContent = title;

            const list = document.createElement("ul");
            for (const sign of group) {
                const item = document.createElement("li");

                const name = document.createElement("strong");
                name.textContent = sign.label;
                const hint = document.createElement("span");
                hint.textContent = sign.hint;

                item.append(name, hint);
                list.append(item);
                this.items.set(sign.id, item);
            }
            container.append(heading, list);
        }
    }

    highlight(signs) {
        const active = new Set(signs.map(sign => sign.id));
        for (const [id, item] of this.items) {
            item.classList.toggle("active", active.has(id));
        }
    }
}
