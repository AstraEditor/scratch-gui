import Utils from "../find-bar/blockly/Utils.js";
export default async function ({ addon, msg, console }) {
  const utils = new Utils(addon);

  const Blockly = await addon.tab.traps.getBlockly();

  Object.defineProperty(Blockly.Gesture.prototype, "jumpToDef", {
    get() {
      return !addon.self.disabled;
    },
  });

  const _doBlockClick_ = Blockly.Gesture.prototype.doBlockClick_;
  Blockly.Gesture.prototype.doBlockClick_ = function() {
    if (!addon.self.disabled && (this.mostRecentEvent_.button === 1 || this.mostRecentEvent_.shiftKey)) {
      jumpTo.call(this);
      return;
    }

    _doBlockClick_.call(this);
  }

  function jumpTo(block) {
    // Wheel button...
    // Intercept clicks to allow jump to...?
    block = block || this.startBlock_;
    for (; block; block = block.getSurroundParent()) {
      if (block.type === "procedures_call") {
        let findProcCode = block.getProcCode();

        let topBlocks = utils.getWorkspace().getTopBlocks();
        for (const root of topBlocks) {
          if (root.type === "procedures_definition") {
            let label = root.getChildren()[0];
            let procCode = label.getProcCode();
            if (procCode && procCode === findProcCode) {
              // Found... navigate to it!
              utils.scrollBlockIntoView(root);
              return;
            }
          }
        }
      }
    }
    _doBlockClick_.call(this);
  }


  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled) return items;
      const makeSpaceItemIndex = items.findIndex((obj) => obj._isDevtoolsFirstItem);
      const insertBeforeIndex =
        makeSpaceItemIndex !== -1
          ? // If "make space" button exists, add own items before it
          makeSpaceItemIndex
          : // If there's no such button, insert at end
          items.length;

      items.splice(
        insertBeforeIndex,
        0,
        {
          enabled: true,
          text: msg("jump_to_definition"),
          callback: () => {
            jumpTo(block)
          },
          separator: false,
        }
      );

      return items;
    },
    { blocks: true }
  );
}
