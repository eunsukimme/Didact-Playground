export interface Element {
  type: string;
  props: {
    children: Array<Element>;
    [key: string]: any;
  };
}

export type SetStateAction<T> = (arg: T) => T;

export interface Hook<T> {
  state: T;
  queue: Array<SetStateAction<T> | T>;
}

export interface Fiber {
  type?: string | Function;
  dom: HTMLElement | Text | null;
  parent?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
  // 직전에 commit 된 fiber 를 가리키는 필드. 이번에 새로 생성된 fiber라면 이 필드는 null이 될 수 있다.
  alternate: Fiber | null;
  // reconcile 과정에서 주어지는 이펙트 태그. commit 단계에서 이 태그에 따라 처리된다.
  // 참고로 rootFiber는 effectTag가 없다. commit의 시작은 rootFiber의 child 부터 시작하기 때문
  effectTag?: "UPDATE" | "PLACEMENT" | "DELETION";
  // function component 는 hooks 를 가질 수 있다.
  hooks?: Array<Hook<any>>;
  props: {
    // fiber 가 만들어지기 전에는 children 은 element 를 갖는다
    children: Array<Element | Fiber>;
    [key: string]: any;
  };
}
