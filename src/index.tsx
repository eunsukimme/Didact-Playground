import { Fiber, Element, Hook, SetStateAction } from "./types/fiber";

function createTextElement(text: string): Element {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createElement(
  type: string,
  props: any,
  ...children: Element[]
): Element {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

function createDom(fiber: Fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type as string);

  updateDom(dom, { children: [] }, fiber.props);

  return dom;
}

function updateDom(
  dom: Fiber["dom"],
  prevProps: Fiber["props"],
  nextProps: Fiber["props"]
) {
  const isEvent = (key: string) => key.startsWith("on");
  const isProperty = (key: string) => key !== "children" && !isEvent(key);
  const isGone =
    (prev: typeof prevProps, next: typeof nextProps) => (key: string) =>
      !(key in next);
  const isNew =
    (prev: typeof prevProps, next: typeof nextProps) => (key: string) =>
      prev[key] !== next[key];

  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      (key: string) => !(key in nextProps) || isNew(prevProps, nextProps)(key)
    )
    .forEach((name) => {
      const eventName = name.toLowerCase().substr(2);
      dom?.removeEventListener(eventName, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      // @ts-ignore
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      // @ts-ignore
      dom[name] = nextProps[name];
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventName = name.toLocaleLowerCase().substr(2);
      dom?.addEventListener(eventName, nextProps[name]);
    });
}

function commitRoot() {
  deletions?.forEach(commitWork);
  commitWork((wipRoot as Fiber).child);
  currentRoot = wipRoot;
  wipRoot = null;
}
function commitWork(fiber?: Fiber) {
  if (!fiber) {
    return;
  }
  // host component 라면 DOM 이 존재하지만, function component 라면 DOM이 존재하지 않는다
  // param으로 받은 fiber는 parent가 반드시 존재한다
  let domParentFiber = fiber.parent;
  // dom 이 있는 parent fiber까지 타고 올라간다
  while (!domParentFiber!.dom) {
    domParentFiber = domParentFiber!.parent;
  }
  const domParent = domParentFiber!.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom) {
    domParent.appendChild(fiber.dom);
  }
  if (fiber.effectTag === "UPDATE" && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate!.props, fiber.props);
  }
  if (fiber.effectTag === "DELETION" && fiber.dom) {
    commitDeletion(domParent, fiber);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(domParent: Fiber["dom"], fiber?: Fiber) {
  if (fiber?.dom) {
    domParent?.removeChild(fiber?.dom);
  } else {
    commitDeletion(domParent, fiber?.child);
  }
}

let nextUnitOfWork: Fiber | null = null;
let wipRoot: Fiber | null = null;
let currentRoot: Fiber | null = null;
let deletions: Fiber[] | null = null;

function render(element: Element, container: HTMLElement) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

function performUnitOfWork(fiber: Fiber): Fiber | null {
  const isFunctionComponent = fiber.type instanceof Function;

  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // return(select) next unit of work
  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber: Fiber | undefined = fiber;

  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }

  return null;
}

let wipFiber: Fiber | null = null;
let hookIndex: number | null = null;

function updateFunctionComponent(fiber: Fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  fiber.hooks = [];
  const children = [(fiber.type as Function)(fiber.props)];

  reconcileChildren(fiber, children);
}

function useState<T>(
  initialValue: T
): [T, (action: T | SetStateAction<T>) => void] {
  const oldHook = wipFiber?.alternate?.hooks?.[hookIndex as number] as Hook<T>;

  const hook: Hook<T> = {
    state: oldHook ? oldHook.state : initialValue,
    queue: [],
  };

  const isSetStateAction = (action): action is SetStateAction<T> => {
    return action instanceof Function;
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    if (isSetStateAction(action)) {
      hook.state = action(hook.state);
    } else {
      hook.state = action;
    }
  });

  const setState = (action: T | SetStateAction<T>) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot?.dom as Fiber["dom"],
      props: currentRoot?.props as Fiber["props"],
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber?.hooks?.push(hook);
  (hookIndex as number)++;

  return [hook.state, setState];
}

function updateHostComponent(fiber: Fiber) {
  // create element and add to dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // create new fibers for children
  reconcileChildren(fiber, fiber.props.children as Element[]);
}

function reconcileChildren(wipFiber: Fiber, childElements: Element[]) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling: Fiber | null = null;

  while (oldFiber || index < childElements.length) {
    const element = childElements[index];
    let newFiber: Fiber | null = null;

    const sameType = oldFiber?.type === element.type;

    if (sameType) {
      newFiber = {
        type: oldFiber!.type,
        props: element.props,
        dom: oldFiber!.dom,
        parent: wipFiber,
        alternate: oldFiber!,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions?.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber!;
    } else {
      prevSibling!.sibling = newFiber!;
    }

    prevSibling = newFiber;
    index++;
  }
}

function workLoop(deadline: IdleDeadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    shouldYield = deadline.timeRemaining() < 1;

    if (!nextUnitOfWork && wipRoot) {
      commitRoot();
    }
  }

  window.requestIdleCallback(workLoop);
}

window.requestIdleCallback(workLoop);

const Didact = {
  createElement,
  render,
  useState,
};

const container = document.getElementById("root") as HTMLElement;

function App() {
  const [count, setCount] = Didact.useState(0);
  const [name, setName] = Didact.useState("");

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount((c) => c + 1)}>increment</button>

      <hr />

      <input
        type="text"
        value={name}
        onInput={(e) => setName(e.target.value)}
      />
      <h2>Hi, {name}</h2>
    </div>
  );
}

const element = <App />;
Didact.render(element, container);
