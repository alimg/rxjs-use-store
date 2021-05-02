import moment from "moment"
import "moment-duration-format"
import React from "react"
import { interval, Observable, of } from "rxjs"
import { map, mapTo, switchMap, timeInterval } from "rxjs/operators"
import { makeStore, useStore } from "../src/store"

export function StopWatch() {
  type State = {time: number, splits: number[], running: boolean}
  const initialState: State = {time: 0, splits: [], running: false}
  const [actions, state] = useStore(makeStore(
    initialState,
    {
      reset: ($: Observable<[]>) => $.pipe(mapTo(() => initialState)),
      toggle: ($: Observable<[boolean]>) => $.pipe(
        switchMap(([running]) => running ? 
          interval(1).pipe(
            timeInterval(), 
            map(delta => (state: State) => ({...state, time: state.time + delta.interval, running: true}))) :
          of((state: State) => ({...state, running: false})))),
      split: ($: Observable<[number]>) => $.pipe(map(([now]) => state => ({...state, splits: [...state.splits, now]})))
    }))

  return <>
    <div>{moment.duration(state.time, 'ms').format("hh:mm:ss.SS", {trim: false})}</div>
    <button onClick={() => actions.toggle(!state.running)}>{state.running ? "Stop" : "Start"}</button>
    <button onClick={actions.reset} disabled={state.running}>Reset</button>
    <button onClick={() => actions.split(state.time)}>Split</button>
    <div>
      <ol>{state.splits.map(split => 
        <li>{moment.duration(split, 'ms').format("hh:mm:ss.SS", {trim: false})}</li>)}
      </ol>
    </div>
  </>
}