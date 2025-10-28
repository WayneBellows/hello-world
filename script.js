const paletteItems = document.querySelectorAll('.palette-item');
const hierarchyRoot = document.getElementById('hierarchy-root');
const groupTemplate = document.getElementById('group-template');
const itemTemplate = document.getElementById('item-template');
const statusMessage = document.querySelector('.status-message');
let idCounter = 1;

const templateConfig = {
  policy: {
    label: () => `Policy ${idCounter}`,
    icon: '🛡️',
    kind: 'policy'
  },
  script: {
    label: () => `Script ${idCounter}`,
    icon: '📜',
    kind: 'script'
  },
  registry: {
    label: () => `Registry ${idCounter}`,
    icon: '🧾',
    kind: 'registry'
  },
  application: {
    label: () => `Application ${idCounter}`,
    icon: '📦',
    kind: 'application'
  },
  group: {
    label: () => `Group ${idCounter}`,
    icon: '📁',
    kind: 'group'
  }
};

function showStatus(message, tone = 'info') {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function updateCounts() {
  const counts = {
    policies: document.querySelectorAll('.node[data-kind="policy"]').length,
    scripts: document.querySelectorAll('.node[data-kind="script"]').length,
    registry: document.querySelectorAll('.node[data-kind="registry"]').length,
    applications: document.querySelectorAll('.node[data-kind="application"]').length,
    groups: document.querySelectorAll('.node[data-kind="group"]').length
  };

  Object.entries(counts).forEach(([key, value]) => {
    const target = document.querySelector(`[data-count="${key}"]`);
    if (target) {
      target.textContent = value;
    }
  });

  const placeholder = hierarchyRoot.querySelector('.placeholder');
  if (placeholder) {
    const hasNodes = hierarchyRoot.querySelectorAll('.node').length > 0;
    placeholder.style.display = hasNodes ? 'none' : '';
  }
}

function registerNode(node) {
  const header = node.querySelector('.node-header');
  header.addEventListener('dragstart', handleDragStart);
  header.addEventListener('dragend', handleDragEnd);
  header.setAttribute('draggable', 'true');

  const deleteButton = node.querySelector('.delete-button');
  if (deleteButton) {
    deleteButton.addEventListener('mousedown', (event) => event.stopPropagation());
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteNode(node);
    });
  }

  if (node.dataset.kind === 'group') {
    const dropZone = node.querySelector('[data-dropzone="group"]');
    dropZone.dataset.parentId = node.dataset.id;
    makeDroppable(dropZone);
    node.classList.add('node-group');
    header.addEventListener('dblclick', () => {
      node.classList.toggle('collapsed');
    });
    node.querySelector('.node-title').addEventListener('blur', () => updateGroupState(node));
    node.querySelector('.node-title').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
    });
    updateGroupState(node);
  }
}

function deleteNode(node) {
  const parent = node.parentElement;
  node.remove();
  const parentGroup = parent && parent.closest('.node-group');
  if (parentGroup) updateGroupState(parentGroup);
  updateCounts();
  showStatus('Item deleted.', 'success');
}

function updateGroupState(groupNode) {
  const badge = groupNode.querySelector('.badge');
  const childList = groupNode.querySelector('.node-list');
  const childCount = childList ? childList.querySelectorAll(':scope > .node').length : 0;
  if (badge) {
    badge.textContent = childCount;
  }
  groupNode.classList.toggle('empty', childCount === 0);
}

function createGroup(label) {
  const fragment = groupTemplate.content.cloneNode(true);
  const node = fragment.querySelector('.node');
  const title = node.querySelector('.node-title');
  node.dataset.id = `node-${idCounter++}`;
  title.textContent = label;
  registerNode(node);
  return node;
}

function createItem(kind, label, icon) {
  const fragment = itemTemplate.content.cloneNode(true);
  const node = fragment.querySelector('.node');
  node.dataset.id = `node-${idCounter++}`;
  node.dataset.kind = kind;
  node.classList.add(`kind-${kind}`);
  node.querySelector('.icon').textContent = icon;
  node.querySelector('.node-title').textContent = label;
  registerNode(node);
  return node;
}

function handleDragStart(event) {
  const node = event.currentTarget.closest('.node');
  if (!node) return;
  node.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({ action: 'move', id: node.dataset.id })
  );
}

function handleDragEnd(event) {
  const node = event.currentTarget.closest('.node');
  if (node) {
    node.classList.remove('dragging');
  }
}

function preventCircularMove(node, dropZone) {
  if (!node || !dropZone) return false;
  const isInsideNode = !!dropZone.closest(`[data-id="${node.dataset.id}"]`);
  if (!isInsideNode) return false;
  if (dropZone.dataset.parentId === node.dataset.id) return false;
  return true;
}

function moveNode(node, dropZone, referenceNode) {
  if (!node) return;
  const dropList = dropZone.matches('.node-list') ? dropZone : dropZone.querySelector('.node-list');
  if (!dropList) return;

  if (preventCircularMove(node, dropZone)) {
    showStatus('Cannot move a group inside one of its descendants.', 'warning');
    return;
  }

  const currentParent = node.parentElement;
  if (referenceNode) {
    dropList.insertBefore(node, referenceNode);
  } else {
    dropList.appendChild(node);
  }

  const previousGroup = currentParent && currentParent.closest('.node-group');
  const newGroup = dropList.closest('.node-group');
  if (previousGroup) updateGroupState(previousGroup);
  if (newGroup) updateGroupState(newGroup);
  updateCounts();
  showStatus('Item moved.', 'success');
}

function addNodeFromTemplate(templateName, dropZone, referenceNode) {
  const config = templateConfig[templateName];
  if (!config) return;
  let node;
  if (templateName === 'group') {
    node = createGroup(config.label());
    node.dataset.kind = 'group';
    node.classList.add('kind-group');
  } else {
    node = createItem(config.kind, config.label(), config.icon);
  }

  const list = dropZone.matches('.node-list') ? dropZone : dropZone.querySelector('.node-list');
  if (!list) return;
  if (referenceNode) {
    list.insertBefore(node, referenceNode);
  } else {
    list.appendChild(node);
  }
  const parentGroup = list.closest('.node-group');
  if (parentGroup) updateGroupState(parentGroup);
  updateCounts();
  showStatus(`${config.kind === 'group' ? 'Group' : config.kind.charAt(0).toUpperCase() + config.kind.slice(1)} added to the hierarchy.`, 'success');
}

function clearDropIndicators(list) {
  if (!list) return;
  list.classList.remove('drop-at-end');
  list.querySelectorAll(':scope > .node.drop-before').forEach((node) => node.classList.remove('drop-before'));
}

function getInsertionReference(list, clientY) {
  if (!list) return null;
  const nodes = [...list.querySelectorAll(':scope > .node:not(.dragging)')];
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return node;
    }
  }
  return null;
}

function makeDroppable(zone) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('droppable-hover');
    if (zone.dataset.dropzone === 'trash') {
      zone.classList.add('active');
    }
    const dropList = zone.matches('.node-list') ? zone : zone.querySelector('.node-list');
    if (dropList) {
      clearDropIndicators(dropList);
      const referenceNode = getInsertionReference(dropList, event.clientY);
      if (referenceNode) {
        referenceNode.classList.add('drop-before');
      } else if (dropList.querySelector(':scope > .node')) {
        dropList.classList.add('drop-at-end');
      }
    }
    const allowed = event.dataTransfer.effectAllowed;
    if (allowed && allowed.includes('copy') && zone.dataset.dropzone !== 'trash') {
      event.dataTransfer.dropEffect = 'copy';
    } else {
      event.dataTransfer.dropEffect = 'move';
    }
  });

  zone.addEventListener('dragleave', (event) => {
    zone.classList.remove('droppable-hover');
    if (zone.dataset.dropzone === 'trash') {
      zone.classList.remove('active');
    }
    const dropList = zone.matches('.node-list') ? zone : zone.querySelector('.node-list');
    if (dropList && (!event.relatedTarget || !zone.contains(event.relatedTarget))) {
      clearDropIndicators(dropList);
    }
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('droppable-hover');
    if (zone.dataset.dropzone === 'trash') {
      zone.classList.remove('active');
    }
    const dropList = zone.matches('.node-list') ? zone : zone.querySelector('.node-list');
    const referenceNode = dropList ? getInsertionReference(dropList, event.clientY) : null;
    if (dropList) {
      clearDropIndicators(dropList);
    }
    const dataJSON = event.dataTransfer.getData('application/json');
    if (!dataJSON) return;

    let data;
    try {
      data = JSON.parse(dataJSON);
    } catch (error) {
      console.error('Invalid drop payload', error);
      return;
    }

    if (zone.dataset.dropzone === 'trash') {
      if (data.action === 'move') {
        const node = document.querySelector(`[data-id="${data.id}"]`);
        if (node) {
          deleteNode(node);
        }
      }
      return;
    }

    if (data.action === 'create') {
      addNodeFromTemplate(data.template, zone, referenceNode);
    } else if (data.action === 'move') {
      const node = document.querySelector(`[data-id="${data.id}"]`);
      if (!node) return;
      moveNode(node, zone, referenceNode);
    }
  });
}

function makePaletteDraggable(item) {
  item.addEventListener('dragstart', (event) => {
    const template = item.dataset.template;
    if (!template) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({ action: 'create', template }));
    item.classList.add('dragging');
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });
}

function initialize() {
  paletteItems.forEach(makePaletteDraggable);
  document.querySelectorAll('[data-dropzone]').forEach(makeDroppable);
  updateCounts();
}

initialize();
