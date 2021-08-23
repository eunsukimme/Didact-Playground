export interface Element {
  type: string;
  props: {
    children: Array<Element>;
    [key: string]: any;
  };
}

export interface Fiber {
  type?: string;
  dom: HTMLElement | Text | null;
  parent?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
  props: {
    // fiber 가 만들어지기 전에는 children 은 element 를 갖는다
    children: Array<Element | Fiber>;
    [key: string]: any;
  };
}
