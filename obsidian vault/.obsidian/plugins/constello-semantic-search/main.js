'use strict';

const { Plugin, PluginSettingTab, Setting, Modal, Notice, requestUrl } = require('obsidian');

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'voyage-3-large',
  // What text from each note gets embedded. This is the lever.
  //   'titleBody'  -> "<title>\n\n<body>"   (default)
  //   'bodyOnly'   -> body only
  //   'titleOnly'  -> filename/title only
  //   'firstChars' -> "<title>\n\n" + first N chars of body
  embedMode: 'titleBody',
  firstChars: 1200,
  topK: 10,
};

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const CACHE_NAME = 'embeddings.json';
const BATCH_SIZE = 32;

// ---- math -------------------------------------------------------------

function normalize(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  const n = Math.sqrt(s) || 1;
  const out = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / n;
  return out;
}

// vectors are stored pre-normalized, so cosine == dot product
function dot(a, b) {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

// ---- plugin -----------------------------------------------------------

module.exports = class SemanticSearchPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.cache = await this.loadCache(); // { mode, model, items: { path: {mtime, vector} } }

    this.addCommand({
      id: 'build-embeddings',
      name: 'Build / refresh embeddings',
      callback: () => this.buildEmbeddings(),
    });

    this.addCommand({
      id: 'semantic-search',
      name: 'Semantic search',
      callback: () => new SearchModal(this.app, this).open(),
    });

    this.addCommand({
      id: 'related-notes',
      name: 'Related notes to current file',
      callback: () => this.relatedToActive(),
    });

    this.addSettingTab(new SettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }

  cachePath() {
    return `${this.manifest.dir}/${CACHE_NAME}`;
  }

  async loadCache() {
    try {
      const raw = await this.app.vault.adapter.read(this.cachePath());
      return JSON.parse(raw);
    } catch (e) {
      return { mode: null, model: null, items: {} };
    }
  }

  async saveCache() {
    await this.app.vault.adapter.write(this.cachePath(), JSON.stringify(this.cache));
  }

  textToEmbed(file, body) {
    const title = file.basename;
    switch (this.settings.embedMode) {
      case 'bodyOnly':
        return body;
      case 'titleOnly':
        return title;
      case 'firstChars':
        return `${title}\n\n${body.slice(0, this.settings.firstChars)}`;
      case 'titleBody':
      default:
        return `${title}\n\n${body}`;
    }
  }

  async voyageEmbed(texts, inputType) {
    if (!this.settings.apiKey) {
      new Notice('Set your Voyage API key in plugin settings first.');
      throw new Error('no api key');
    }
    const vectors = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const res = await requestUrl({
        url: VOYAGE_URL,
        method: 'POST',
        throw: false,
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: batch,
          model: this.settings.model,
          input_type: inputType, // 'document' for notes, 'query' for searches
        }),
      });
      if (res.status < 200 || res.status >= 300) {
        const msg = (res.json && res.json.detail) || res.text || `HTTP ${res.status}`;
        new Notice(`Voyage error: ${msg}`);
        throw new Error(`voyage ${res.status}`);
      }
      // keep order stable
      const data = res.json.data.sort((a, b) => a.index - b.index);
      for (const d of data) vectors.push(normalize(d.embedding));
    }
    return vectors;
  }

  async buildEmbeddings() {
    const files = this.app.vault.getMarkdownFiles();
    const mode = this.settings.embedMode;
    const model = this.settings.model;

    // if the embed lever or model changed, the whole cache is stale
    const fullRebuild = this.cache.mode !== mode || this.cache.model !== model;
    if (fullRebuild) this.cache.items = {};
    this.cache.mode = mode;
    this.cache.model = model;

    const toEmbed = [];
    const meta = [];
    for (const f of files) {
      const prev = this.cache.items[f.path];
      if (prev && prev.mtime === f.stat.mtime) continue; // unchanged
      const body = await this.app.vault.cachedRead(f);
      toEmbed.push(this.textToEmbed(f, body));
      meta.push({ path: f.path, mtime: f.stat.mtime });
    }

    // drop cache entries for files that no longer exist
    const live = new Set(files.map((f) => f.path));
    for (const p of Object.keys(this.cache.items)) {
      if (!live.has(p)) delete this.cache.items[p];
    }

    if (toEmbed.length === 0) {
      await this.saveCache();
      new Notice('Embeddings already up to date.');
      return;
    }

    new Notice(`Embedding ${toEmbed.length} note(s)…`);
    try {
      const vectors = await this.voyageEmbed(toEmbed, 'document');
      for (let i = 0; i < meta.length; i++) {
        this.cache.items[meta[i].path] = { mtime: meta[i].mtime, vector: vectors[i] };
      }
      await this.saveCache();
      new Notice(`Done. ${Object.keys(this.cache.items).length} notes indexed.`);
    } catch (e) {
      // notice already shown
    }
  }

  rank(queryVec, excludePath) {
    const results = [];
    for (const [path, item] of Object.entries(this.cache.items)) {
      if (path === excludePath) continue;
      results.push({ path, score: dot(queryVec, item.vector) });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.settings.topK);
  }

  async search(query) {
    if (Object.keys(this.cache.items).length === 0) {
      new Notice('No embeddings yet — run "Build / refresh embeddings" first.');
      return [];
    }
    const [qv] = await this.voyageEmbed([query], 'query');
    return this.rank(qv, null);
  }

  async relatedToActive() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active file.');
      return;
    }
    const item = this.cache.items[file.path];
    let qv;
    if (item) {
      qv = item.vector;
    } else {
      const body = await this.app.vault.cachedRead(file);
      [qv] = await this.voyageEmbed([this.textToEmbed(file, body)], 'document');
    }
    const results = this.rank(qv, file.path);
    new ResultsModal(this.app, this, `Related to "${file.basename}"`, results).open();
  }

  async openPath(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) await this.app.workspace.getLeaf(false).openFile(file);
  }
};

// ---- UI ---------------------------------------------------------------

class SearchModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Semantic search' });
    const input = contentEl.createEl('input', { type: 'text', placeholder: 'a word or a phrase…' });
    input.style.width = '100%';
    input.focus();
    const list = contentEl.createDiv();

    const run = async () => {
      list.empty();
      const q = input.value.trim();
      if (!q) return;
      list.createEl('div', { text: 'searching…' });
      const results = await this.plugin.search(q);
      list.empty();
      this.renderResults(list, results);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run();
    });
  }
  renderResults(container, results) {
    if (!results.length) {
      container.createEl('div', { text: 'no matches' });
      return;
    }
    for (const r of results) {
      const row = container.createDiv();
      row.style.padding = '6px 4px';
      row.style.cursor = 'pointer';
      row.style.borderBottom = '1px solid var(--background-modifier-border)';
      row.createEl('span', { text: r.path.replace(/\.md$/, '') });
      row.createEl('span', {
        text: `  ${r.score.toFixed(3)}`,
        cls: 'mod-muted',
      }).style.color = 'var(--text-muted)';
      row.addEventListener('click', async () => {
        this.close();
        await this.plugin.openPath(r.path);
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
}

class ResultsModal extends Modal {
  constructor(app, plugin, title, results) {
    super(app);
    this.plugin = plugin;
    this.title = title;
    this.results = results;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.title });
    const sm = new SearchModal(this.app, this.plugin);
    sm.renderResults.call({ plugin: this.plugin, close: () => this.close() }, contentEl, this.results);
  }
  onClose() {
    this.contentEl.empty();
  }
}

class SettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Voyage API key')
      .setDesc('Stored locally in this plugin\'s data.json. Do not sync it to a public repo.')
      .addText((t) =>
        t.setValue(this.plugin.settings.apiKey).onChange(async (v) => {
          this.plugin.settings.apiKey = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Model')
      .addText((t) =>
        t.setValue(this.plugin.settings.model).onChange(async (v) => {
          this.plugin.settings.model = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('What gets embedded')
      .setDesc('Changing this marks the whole index stale on next build.')
      .addDropdown((d) =>
        d
          .addOption('titleBody', 'Title + body')
          .addOption('bodyOnly', 'Body only')
          .addOption('titleOnly', 'Title only')
          .addOption('firstChars', 'Title + first N chars')
          .setValue(this.plugin.settings.embedMode)
          .onChange(async (v) => {
            this.plugin.settings.embedMode = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('First N chars (for "first N chars" mode)')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.firstChars)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n)) {
            this.plugin.settings.firstChars = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName('Results (top-k)')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.topK)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n)) {
            this.plugin.settings.topK = n;
            await this.plugin.saveSettings();
          }
        })
      );
  }
}
