"use strict";

/**
 * A strict fake of Apps Script's CardService, for running the add-on's card
 * code in Node.js.
 *
 * What it checks:
 * - Only classes and methods that exist in CardService can be used. The list
 *   below comes from the @types/google-apps-script package, version 2.0.14
 *   (google-apps-script.card-service.d.ts).
 * - Arguments have the right kind: a built Card where a Card is expected,
 *   string action parameters, an Action where an Action is expected.
 * - Built cards have what CardService needs: a header title, sections with
 *   widgets, button text, field names, one selected item per dropdown, and no
 *   field name used twice on one card.
 * - No visible text contains an emoji.
 *
 * What it cannot check: how Google renders a card, text length limits, or any
 * rule of CardService that is not listed here. Passing these tests means the
 * card code runs and follows these rules, not that the card looks right in
 * Google Calendar.
 */

const API = {
  Action: [
    "addRequiredWidget", "setAllWidgetsAreRequired", "setFunctionName", "setInteraction", "setLoadIndicator",
    "setParameters", "setPersistValues",
  ],
  ActionResponseBuilder: ["build", "setNavigation", "setNotification", "setOpenLink", "setStateChanged"],
  ButtonSet: ["addButton"],
  CardBuilder: [
    "addCardAction", "addSection", "build", "setHeader", "setName", "setFixedFooter", "setDisplayStyle",
    "setPeekCardHeader",
  ],
  CardHeader: ["setImageAltText", "setImageStyle", "setImageUrl", "setSubtitle", "setTitle"],
  CardSection: ["addWidget", "setCollapsible", "setHeader", "setNumUncollapsibleWidgets"],
  DecoratedText: [
    "setAuthorizationAction", "setBottomLabel", "setButton", "setComposeAction", "setEndIcon", "setIcon",
    "setIconAltText", "setIconUrl", "setOnClickAction", "setOnClickOpenLinkAction", "setOpenLink", "setStartIcon",
    "setSwitchControl", "setText", "setTopLabel", "setWrapText",
  ],
  Divider: [],
  FixedFooter: ["setPrimaryButton", "setSecondaryButton"],
  Navigation: ["popCard", "popToNamedCard", "popToRoot", "printJson", "pushCard", "updateCard"],
  Notification: ["setText"],
  OpenLink: ["setOnClose", "setOpenAs", "setUrl"],
  SelectionInput: [
    "addItem", "addMultiSelectItem", "setExternalDataSource", "setFieldName", "setMultiSelectMaxSelectedItems",
    "setMultiSelectMinQueryLength", "setOnChangeAction", "setTitle", "setType",
  ],
  Switch: ["setFieldName", "setOnChangeAction", "setSelected", "setValue", "setControlType"],
  TextButton: [
    "setAltText", "setAuthorizationAction", "setBackgroundColor", "setComposeAction", "setDisabled",
    "setOnClickAction", "setOnClickOpenLinkAction", "setOpenLink", "setText", "setTextButtonStyle",
  ],
  TextInput: [
    "setFieldName", "setHint", "setMultiline", "setOnChangeAction", "setSuggestions", "setSuggestionsAction",
    "setTitle", "setValidation", "setValue",
  ],
  TextParagraph: ["setText"],
};

const FACTORIES = {
  newAction: "Action",
  newActionResponseBuilder: "ActionResponseBuilder",
  newButtonSet: "ButtonSet",
  newCardBuilder: "CardBuilder",
  newCardHeader: "CardHeader",
  newCardSection: "CardSection",
  newDecoratedText: "DecoratedText",
  newDivider: "Divider",
  newFixedFooter: "FixedFooter",
  newNavigation: "Navigation",
  newNotification: "Notification",
  newOpenLink: "OpenLink",
  newSelectionInput: "SelectionInput",
  newSwitch: "Switch",
  newTextButton: "TextButton",
  newTextInput: "TextInput",
  newTextParagraph: "TextParagraph",
};

const ENUMS = {
  TextButtonStyle: ["OUTLINED", "FILLED", "FILLED_TONAL", "BORDERLESS"],
  SelectionInputType: ["CHECK_BOX", "RADIO_BUTTON", "DROPDOWN", "SWITCH", "MULTI_SELECT"],
  LoadIndicator: ["SPINNER", "NONE"],
  ImageStyle: ["SQUARE", "CIRCLE"],
  SwitchControlType: ["SWITCH", "CHECK_BOX"],
  OnClose: ["NOTHING", "RELOAD", "RELOAD_ADD_ON"],
  OpenAs: ["FULL_SIZE", "OVERLAY"],
};

const ENUM_SETTERS = {
  setTextButtonStyle: "TextButtonStyle",
  setType: "SelectionInputType",
  setLoadIndicator: "LoadIndicator",
  setImageStyle: "ImageStyle",
  setControlType: "SwitchControlType",
  setOnClose: "OnClose",
  setOpenAs: "OpenAs",
};
const BOOLEAN_SETTERS = ["setCollapsible", "setWrapText", "setSelected", "setDisabled", "setMultiline", "setStateChanged"];

const WIDGET_TYPES = new Set(["TextParagraph", "DecoratedText", "ButtonSet", "SelectionInput", "TextInput", "Divider"]);
const EMOJI = /\p{Extended_Pictographic}/u;

class CardServiceError extends Error {}

function fail(message) {
  throw new CardServiceError(message);
}

function checkText(where, value) {
  if (typeof value !== "string") fail(`${where} needs a string, got ${typeof value}`);
  if (EMOJI.test(value)) fail(`${where} contains an emoji: ${JSON.stringify(value)}`);
}

function createCardService() {
  const log = { actions: [], cards: [], responses: [] };
  const STATE = Symbol("state");

  function stateOf(value, expectedTypes, where) {
    const state = value && value[STATE];
    if (!state) fail(`${where} needs a CardService ${expectedTypes.join(" or ")}, got ${value}`);
    if (!expectedTypes.includes(state.type)) fail(`${where} needs ${expectedTypes.join(" or ")}, got ${state.type}`);
    return state;
  }

  function make(type) {
    const state = { type, props: {}, items: [], widgets: [], buttons: [], sections: [], ops: [] };
    if (type === "Action") log.actions.push(state);
    const allowed = new Set(API[type]);
    const proxy = new Proxy(
      {},
      {
        get(target, prop) {
          if (prop === STATE) return state;
          if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") return undefined;
          if (!allowed.has(prop)) fail(`CardService.${type} has no method ${String(prop)}()`);
          return (...args) => invoke(type, state, prop, args, proxy);
        },
      }
    );
    return proxy;
  }

  function invoke(type, state, method, args, self) {
    const where = `${type}.${method}`;
    switch (method) {
      case "build":
        return type === "CardBuilder" ? buildCard(state) : buildResponse(state);
      case "addWidget":
        state.widgets.push(stateOf(args[0], [...WIDGET_TYPES], where));
        return self;
      case "addSection":
        state.sections.push(stateOf(args[0], ["CardSection"], where));
        return self;
      case "addButton":
        state.buttons.push(stateOf(args[0], ["TextButton"], where));
        return self;
      case "addItem":
        if (args.length !== 3) fail(`${where} takes (text, value, selected)`);
        checkText(where + " text", args[0]);
        if (typeof args[1] !== "string") fail(`${where} value must be a string, got ${typeof args[1]}`);
        if (typeof args[2] !== "boolean") fail(`${where} selected must be a boolean`);
        state.items.push({ text: args[0], value: args[1], selected: args[2] });
        return self;
      case "setParameters": {
        const params = args[0];
        if (!params || typeof params !== "object") fail(`${where} needs an object`);
        Object.keys(params).forEach((key) => {
          if (typeof params[key] !== "string") fail(`${where}: parameter ${key} must be a string, got ${typeof params[key]}`);
        });
        state.props.parameters = Object.assign({}, params);
        return self;
      }
      case "setOnClickAction":
      case "setOnChangeAction":
        state.props[method] = stateOf(args[0], ["Action"], where);
        return self;
      case "setSwitchControl":
        state.props.switch = stateOf(args[0], ["Switch"], where);
        return self;
      case "setButton":
        state.props.button = stateOf(args[0], ["TextButton"], where);
        return self;
      case "setFixedFooter":
        state.props.footer = stateOf(args[0], ["FixedFooter"], where);
        return self;
      case "setPrimaryButton":
      case "setSecondaryButton":
        state.props[method] = stateOf(args[0], ["TextButton"], where);
        return self;
      case "setNavigation":
        state.props.navigation = stateOf(args[0], ["Navigation"], where);
        return self;
      case "setNotification":
        state.props.notification = stateOf(args[0], ["Notification"], where);
        return self;
      case "setOpenLink":
        state.props.openLink = stateOf(args[0], ["OpenLink"], where);
        return self;
      case "setHeader":
        if (type === "CardBuilder") state.props.header = stateOf(args[0], ["CardHeader"], where);
        else {
          checkText(where, args[0]);
          state.props.header = args[0];
        }
        return self;
      case "pushCard":
      case "updateCard": {
        const card = args[0];
        if (!card || card.kind !== "Card") fail(`${where} needs a built Card (call build()), got ${card && card.constructor ? "a builder" : card}`);
        state.ops.push({ op: method, card });
        return self;
      }
      case "popCard":
      case "popToRoot":
        if (args.length) fail(`${where} takes no arguments`);
        state.ops.push({ op: method });
        return self;
      case "popToNamedCard":
        state.ops.push({ op: method, name: args[0] });
        return self;
      default:
        if (args.length !== 1) fail(`${where} takes one argument, got ${args.length}`);
        if (["setText", "setTitle", "setSubtitle", "setTopLabel", "setBottomLabel", "setHint", "setFunctionName", "setFieldName", "setName"].includes(method)) {
          checkText(where, args[0]);
        }
        if (method === "setValue" && typeof args[0] !== "string") fail(`${where} needs a string`);
        if (ENUM_SETTERS[method] && !ENUMS[ENUM_SETTERS[method]].includes(args[0])) {
          fail(`${where} needs a CardService.${ENUM_SETTERS[method]} value, got ${args[0]}`);
        }
        if (BOOLEAN_SETTERS.includes(method) && typeof args[0] !== "boolean") fail(`${where} needs a boolean`);
        if (method === "setNumUncollapsibleWidgets" && !Number.isInteger(args[0])) fail(`${where} needs an integer`);
        state.props[method.replace(/^set/, "").replace(/^./, (c) => c.toLowerCase())] = args[0];
        return self;
    }
  }

  function validateWidget(widget, fieldNames) {
    const p = widget.props;
    const where = widget.type;
    if (widget.type === "TextParagraph" && !p.text) fail("TextParagraph needs text");
    if (widget.type === "DecoratedText") {
      if (!p.text) fail("DecoratedText needs text");
      if (p.button && p.switch) fail("DecoratedText cannot have both a button and a switch");
      if (p.button) validateButton(p.button);
      if (p.switch) {
        if (!p.switch.props.fieldName) fail("Switch needs a field name");
        addField(fieldNames, p.switch.props.fieldName);
        if (p.switch.props.setOnChangeAction) validateAction(p.switch.props.setOnChangeAction);
      }
      if (p.setOnClickAction) validateAction(p.setOnClickAction);
    }
    if (widget.type === "ButtonSet") {
      if (!widget.buttons.length) fail("ButtonSet needs at least one button");
      widget.buttons.forEach(validateButton);
    }
    if (widget.type === "SelectionInput") {
      if (!p.fieldName) fail("SelectionInput needs a field name");
      if (!p.type) fail("SelectionInput needs a type");
      if (!widget.items.length) fail(`SelectionInput ${p.fieldName} needs items`);
      const selected = widget.items.filter((item) => item.selected).length;
      if (p.type === "DROPDOWN" && selected > 1) fail(`Dropdown ${p.fieldName} has ${selected} selected items`);
      const values = widget.items.map((item) => item.value);
      if (new Set(values).size !== values.length) fail(`SelectionInput ${p.fieldName} has duplicate values`);
      addField(fieldNames, p.fieldName);
      if (p.setOnChangeAction) validateAction(p.setOnChangeAction);
    }
    if (widget.type === "TextInput") {
      if (!p.fieldName) fail("TextInput needs a field name");
      if (!p.title && !p.hint) fail(`TextInput ${p.fieldName} needs a title or hint`);
      addField(fieldNames, p.fieldName);
      if (p.setOnChangeAction) validateAction(p.setOnChangeAction);
    }
    return where;
  }

  function addField(fieldNames, name) {
    if (fieldNames.has(name)) fail(`Field name ${name} is used twice on one card`);
    fieldNames.add(name);
  }

  function validateButton(button) {
    if (!button.props.text) fail("TextButton needs text");
    checkText("TextButton text", button.props.text);
    if (!button.props.setOnClickAction && !button.props.openLink) fail(`Button ${button.props.text} does nothing`);
    if (button.props.setOnClickAction) validateAction(button.props.setOnClickAction);
  }

  function validateAction(action) {
    if (!action.props.functionName) fail("Action needs a function name");
  }

  function buildCard(state) {
    const header = state.props.header;
    if (header && !header.props.title) fail("CardHeader needs a title");
    if (!state.sections.length) fail("A card needs at least one section");
    const fieldNames = new Set();
    state.sections.forEach((section) => {
      if (!section.widgets.length) fail(`Section ${section.props.header || "(no header)"} has no widgets`);
      section.widgets.forEach((widget) => validateWidget(widget, fieldNames));
    });
    const footer = state.props.footer;
    if (footer) {
      if (!footer.props.setPrimaryButton) fail("FixedFooter needs a primary button");
      validateButton(footer.props.setPrimaryButton);
      if (footer.props.setSecondaryButton) validateButton(footer.props.setSecondaryButton);
    }
    const card = {
      kind: "Card",
      name: state.props.name || "",
      title: header ? header.props.title : "",
      subtitle: header ? header.props.subtitle || "" : "",
      sections: state.sections,
      footer: footer ? { primary: footer.props.setPrimaryButton, secondary: footer.props.setSecondaryButton } : null,
      fieldNames: [...fieldNames],
    };
    log.cards.push(card);
    return card;
  }

  function buildResponse(state) {
    const navigation = state.props.navigation ? state.props.navigation.ops : [];
    const notification = state.props.notification ? state.props.notification.props.text : "";
    if (state.props.notification && !notification) fail("Notification needs text");
    if (!navigation.length && !notification && !state.props.openLink) fail("ActionResponse does nothing");
    const response = { kind: "ActionResponse", navigation, notification };
    log.responses.push(response);
    return response;
  }

  const service = {};
  Object.keys(FACTORIES).forEach((name) => {
    service[name] = (...args) => {
      if (args.length) fail(`CardService.${name} takes no arguments`);
      return make(FACTORIES[name]);
    };
  });
  Object.keys(ENUMS).forEach((name) => {
    service[name] = Object.freeze(Object.fromEntries(ENUMS[name].map((value) => [value, value])));
  });
  return { CardService: new Proxy(service, {
    get(target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (!(prop in target)) fail(`CardService has no member ${String(prop)} in this fake`);
      return target[prop];
    },
  }), log };
}

// ---------------------------------------------------------------------------
// Reading built cards, and acting like the user
// ---------------------------------------------------------------------------

function widgetsOf(card) {
  return card.sections.flatMap((section) => section.widgets);
}

/** Every piece of visible text on a card, for simple assertions. */
function cardText(card) {
  const parts = [card.title, card.subtitle];
  card.sections.forEach((section) => {
    parts.push(section.props.header || "");
    section.widgets.forEach((w) => {
      const p = w.props;
      parts.push(p.text || "", p.topLabel || "", p.bottomLabel || "", p.title || "", p.hint || "");
      if (p.button) parts.push(p.button.props.text);
      w.buttons.forEach((b) => parts.push(b.props.text));
      w.items.forEach((item) => parts.push(item.text));
    });
  });
  if (card.footer) {
    parts.push(card.footer.primary.props.text);
    if (card.footer.secondary) parts.push(card.footer.secondary.props.text);
  }
  return parts.filter(Boolean).join("\n");
}

/** Every button on a card: in button sets, on decorated text, and in the footer. */
function buttonsOf(card) {
  const buttons = [];
  widgetsOf(card).forEach((w) => {
    w.buttons.forEach((b) => buttons.push(b));
    if (w.props.button) buttons.push(w.props.button);
  });
  if (card.footer) {
    buttons.push(card.footer.primary);
    if (card.footer.secondary) buttons.push(card.footer.secondary);
  }
  return buttons;
}

function findButton(card, text, index) {
  const matches = buttonsOf(card).filter((b) => b.props.text === text);
  if (!matches.length) throw new Error(`No button "${text}" on card ${card.name}. Buttons: ${buttonsOf(card).map((b) => b.props.text).join(", ")}`);
  return matches[index || 0];
}

/** The input widget (or switch) with a field name. */
function findInput(card, fieldName) {
  for (const w of widgetsOf(card)) {
    if ((w.type === "SelectionInput" || w.type === "TextInput") && w.props.fieldName === fieldName) return w;
    if (w.props.switch && w.props.switch.props.fieldName === fieldName) return w.props.switch;
  }
  throw new Error(`No input ${fieldName} on card ${card.name}`);
}

/**
 * The form values Google sends for a card, as {field: [values]}. Unchecked
 * switches, empty checkbox groups and empty text inputs are left out, as the
 * add-on platform does. `changes` overrides values ({field: [values] | null}).
 */
function formValues(card, changes) {
  const values = {};
  widgetsOf(card).forEach((w) => {
    if (w.type === "SelectionInput") {
      const selected = w.items.filter((item) => item.selected).map((item) => item.value);
      if (w.props.type === "DROPDOWN") values[w.props.fieldName] = [selected.length ? selected[0] : w.items[0].value];
      else if (selected.length) values[w.props.fieldName] = selected;
    } else if (w.type === "TextInput") {
      if (w.props.value) values[w.props.fieldName] = [w.props.value];
    } else if (w.props.switch) {
      const s = w.props.switch.props;
      if (s.selected) values[s.fieldName] = [s.value];
    }
  });
  Object.keys(changes || {}).forEach((field) => {
    if (changes[field] === null) delete values[field];
    else values[field] = [].concat(changes[field]).map(String);
  });
  return values;
}

/** An add-on event object, V8 style. */
function eventFor(action, values, timeZone) {
  const formInputs = {};
  Object.keys(values || {}).forEach((field) => {
    formInputs[field] = { stringInputs: { value: values[field] } };
  });
  const parameters = Object.assign({}, action ? action.props.parameters : {});
  return {
    commonEventObject: {
      hostApp: "CALENDAR",
      platform: "WEB",
      parameters,
      formInputs,
      timeZone: timeZone ? { id: timeZone, offset: "0" } : undefined,
    },
    parameters,
  };
}

/** Runs the action of a button, like a click. */
function click(card, buttonText, changes, index) {
  const action = findButton(card, buttonText, index).props.setOnClickAction;
  return runAction(action, formValues(card, changes));
}

/**
 * Changes one input like the user would, so later clicks on the same card send
 * the new value too, and runs the input's on-change action.
 * value: a string for dropdowns and text, an array for checkboxes, a boolean for switches.
 */
function change(card, fieldName, value) {
  const input = findInput(card, fieldName);
  const action = input.props.setOnChangeAction;
  if (!action) throw new Error(`Input ${fieldName} has no on-change action`);
  if (input.type === "Switch") {
    input.props.selected = !!value;
  } else if (input.type === "TextInput") {
    input.props.value = String(value);
  } else {
    const wanted = [].concat(value).map(String);
    const known = input.items.map((item) => item.value);
    wanted.forEach((v) => {
      if (!known.includes(v)) throw new Error(`${fieldName} has no item ${v}; items: ${known.join(", ")}`);
    });
    input.items.forEach((item) => {
      item.selected = wanted.includes(item.value);
    });
  }
  return runAction(action, formValues(card));
}

/** The value a dropdown shows. */
function selectedValue(card, fieldName) {
  const input = findInput(card, fieldName);
  const selected = input.items.filter((item) => item.selected);
  return selected.length ? selected[0].value : input.items[0].value;
}

function runAction(action, values) {
  const fn = globalThis[action.props.functionName];
  if (typeof fn !== "function") throw new Error(`Action ${action.props.functionName} is not a global function`);
  return fn(eventFor(action, values));
}

/** The card an action response shows at the end of its navigation. */
function shownCard(response) {
  const ops = response.navigation.filter((op) => op.card);
  return ops.length ? ops[ops.length - 1].card : null;
}

module.exports = {
  createCardService,
  CardServiceError,
  cardText,
  buttonsOf,
  findButton,
  findInput,
  formValues,
  eventFor,
  click,
  change,
  selectedValue,
  runAction,
  shownCard,
  widgetsOf,
  API,
};
