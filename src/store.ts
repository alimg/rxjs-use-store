import { Subject, Observable , merge, BehaviorSubject, EMPTY, of } from "rxjs"
import { DependencyList, useEffect, useState } from "react"
import { combineLatestWith, map, scan, startWith } from "rxjs/operators"
import useConstant from "use-constant";

type Reducer<State> = (state: State) => State;

export type ActionFactory<State, Action> = ($: Observable<Action>) => Observable<Reducer<State>>

export type ActionsType<State> = {[key: string]:  ActionFactory<State, any>}

export type Store<State, Actions extends ActionsType<State>, Input extends DependencyList> = {
  initialState: State
  /**
   * Declares the actions that can be performed on this store and how they may affect the state. 
   * 
   * Each action is defined as an {@link ActionFactory}, which is a factory function that takes an stream of input data 
   * and produces a stream of reducers. Action factories are composed into a state stream when the {@link useState}
   * is called within a React component for the first time.
   * 
   * {@link useStore} returns a matching callback method for each ActionFactory with the appropriate type signature.
   * Incoming input observable will emit a value only when the callback method is invoked.
   */
  actions: Actions

  /**
   * Similar to the members of `actions`, but the incoming observable only emit data when the input (i.e., `deps` given 
   * when the useStore was called) is changed.
   */
  inputAction?: ActionFactory<State, Input>

  /**
   * Maps the output state after applying all action reducers to produce the final output. The output is not applied 
   * back to the state like the rest of the input actions.
   */
  outputAction?: ActionFactory<State, State>
  
  /**
   * Custom composition logic to apply input and action reducer to produce final state.
   * 
   * You can make your own composer from scratch or combine your logic with the {@link: defaultComposer}.
   * 
   * If not specified, state will be produced using the following default:
   * @example
   *  (reducer$, initialState) => reducer$.pipe(
   *    scan((state, reducer) => reducer(state), initialState),
   *    startWith(initialState))
   * 
   */
  outputComposer?: (state$: Observable<Reducer<State>>, initialState: State) => Observable<State>
};

export type ActionParameters<T extends ($: Observable<any>) => any> = T extends ($: Observable<infer P>) => any ? P : never;

/**
 * React hook for subscribing to the state and callbacks of a Store.
 */
export function useStore<State, Actions extends ActionsType<State>, Deps extends DependencyList = never>(
    store: Store<State, Actions, Deps>, 
    deps?: Deps): readonly [{[key in keyof Actions]: (...args: ActionParameters<Actions[key]>) => void }, State] {
  
  function compose(store: Store<State, Actions, Deps>, input$: Observable<Deps>) {
    const actionSubjects = Object.entries(store.actions)
      .reduce((a, [key, _]) => ({...a, [key]: new Subject()}), 
      {} as {[key in keyof Actions]: Subject<Observable<ActionParameters<Actions[key]>>>})

    const actionReducers$ = Object.entries(actionSubjects).reduce(
      (a, [key, subject]) => ({...a, [key]: store.actions[key](subject)}),
      {} as {[key in keyof Actions]: Observable<Reducer<State>> }
    )

    const actionCallbacks = Object.entries(actionSubjects)
      .reduce((actions, [key, subject]) => ({...actions, [key]: (...args: any) => {
        subject.next(args);
      }}), {} as {[key in keyof Actions]: (...args: ActionParameters<Actions[key]>) => void })
    
    const otherInput$: Observable<Reducer<State>> = store.inputAction?.(input$) || EMPTY
    const reducer$ = merge(otherInput$, ...Object.values(actionReducers$))
    const state$ = (store.outputComposer || defaultComposer)(reducer$, store.initialState)
    const output$ = state$.pipe(
      combineLatestWith(store.outputAction?.(state$) || of((s: State) => s)), 
      map(([state, reducer]) => reducer(state)))
    return [actionCallbacks, output$] as const
  }

  const input$ = useConstant(() => new BehaviorSubject<Deps>(deps!))
  useEffect(() => {
    input$.next(deps!)
  }, deps || [])

  const [initialState, actions, state$] = useConstant(() => {
    const [actions, state$] = compose(store, input$)
    return [store.initialState, actions, state$]
  })
  const [state, setState] = useState<State>(initialState)
  useEffect(() => {
    const subscription = state$.subscribe(newState => {
      setState(newState)
    })
    return () => {
      subscription.unsubscribe()
      input$.complete()
    }
  }, [state$])
  
  return [actions, state] as const
}

export function defaultComposer<State>(reducer$: Observable<Reducer<State>>, initialState: State): Observable<State> {
  return reducer$.pipe(
    scan((state, reducer) => reducer(state), initialState),
    startWith(initialState))
}

/**
 * Convenience method for defining a Store object. Use it when your are letting type inference to detect signatures
 * of the actions and callback from the initial state type automatically.
 */
export function makeStore<S, A extends ActionsType<S>, I extends DependencyList = any>(
    initialState: S, actions: A, options?: {
      inputAction?: ActionFactory<S, I>, 
      outputAction?: ActionFactory<S, S>,
      outputComposer?: (state$: Observable<Reducer<S>>, initialState: S) => Observable<S>
    }): Store<S, A, I> {
  return {
    initialState,
    actions,
    ...options
  }
} 
