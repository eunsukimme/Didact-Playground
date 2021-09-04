import { Fiber, Element } from "./types/fiber";

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
      : document.createElement(fiber.type!);

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
  // commit한 시점에 모든 fiber는 DOM 노드가 생성되어있다.
  // param으로 받은 fiber는 parent가 반드시 존재한다
  // 그러므로 type assertion을 수행
  const domParent = fiber.parent!.dom;
  if (fiber.effectTag === "PLACEMENT") {
    domParent?.appendChild(fiber.dom!);
  }
  if (fiber.effectTag === "DELETION") {
    domParent?.removeChild(fiber.dom!);
  }
  if (fiber.effectTag === "UPDATE") {
    updateDom(fiber.dom, fiber.alternate!.props, fiber.props);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
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
  // TODO create element and add to dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // TODO create new fibers for children
  const childElements = fiber.props.children as Element[];
  reconcileChildren(fiber, childElements);

  // TODO return(select) next unit of work
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
};

const container = document.getElementById("root") as HTMLElement;

const updateValue = (e: any) => {
  console.log(e);
  rerender(e.target.value);
};

const rerender = (value: string) => {
  const element = (
    // @ts-ignore
    <div>
      {/* @ts-ignore */}
      <input onInput={updateValue} value={value} />
      {/* @ts-ignore */}
      <h2>Hello {value}</h2>
      {/* @ts-ignore */}
    </div>
  );
  Didact.render(element, container);
};

rerender("World");
