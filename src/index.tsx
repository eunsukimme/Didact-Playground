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

  const isProperty = (property: string) => property !== "children";

  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((prop) => {
      // @ts-ignore
      dom[prop] = fiber.props[prop];
    });

  return dom;
}

function commitRoot() {
  commitWork((wipRoot as Fiber).child);
  wipRoot = null;
}
function commitWork(fiber?: Fiber) {
  if (!fiber) {
    return;
  }
  // commit한 시점에 모든 fiber는 DOM 노드가 생성되어있다.
  // param으로 받은 fiber는 parent가 반드시 존재한다
  // 그러므로 type assertion을 수행
  fiber.parent!.dom!.appendChild(fiber.dom!);
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

let nextUnitOfWork: Fiber | null = null;
let wipRoot: Fiber | null = null;

function render(element: Element, container: HTMLElement) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
  };
  nextUnitOfWork = wipRoot;
}

function performUnitOfWork(fiber: Fiber): Fiber | null {
  // TODO create element and add to dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // TODO create new fibers for children
  const childElements = fiber.props.children as Element[];
  let index = 0;
  let prevSibling: Fiber | null = null;

  while (index < childElements.length) {
    const element = childElements[index];

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    };

    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling!.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }

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

/** @jsx Didact.createElement */
const element = (
  /** @ts-ignore */
  <div>
    {/* @ts-ignore */}
    <h1>Hello world!</h1>
    {/* @ts-ignore */}
  </div>
);

const container = document.getElementById("root") as HTMLElement;
Didact.render(element, container);
