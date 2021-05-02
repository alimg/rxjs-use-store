import { Subject, Observable , merge, BehaviorSubject, EMPTY, of } from "rxjs"
import { DependencyList, useEffect, useState } from "react"
import { combineLatestWith, map, scan, startWith } from "rxjs/operators"
import useConstant from "use-constant";

type Reducer<State> = (state: State) => State;

export type ActionFactory<State, Action> = ($: Observable<Action>) => Observable<Reducer<State>>

export type ActionsType<State> = {[key: string]:  ActionFactory<State, any>}

export type Store<State, Actions extends ActionsType<State>, Input extends DependencyList> = {
  initialState: State
  actions: Actions
  inputAction?: ActionFactory<State, Input>
  outputAction?: ActionFactory<State, State>
};

export type ActionParameters<T extends ($: Observable<any>) => any> = T extends ($: Observable<infer P>) => any ? P : never;

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
    const state$ = reducer$.pipe(
        scan((state, reducer) => reducer(state), store.initialState), startWith(store.initialState))
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


export function makeStore<S, A extends ActionsType<S>, I extends DependencyList = any>(
    initialState: S, actions: A, options?: {
      inputAction?: ActionFactory<S, I>, 
      outputAction?: ActionFactory<S, S>
    }): Store<S, A, I> {
  return {
    initialState,
    actions,
    ...options
  }
} 
