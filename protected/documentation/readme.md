Suppose you have steps:

login -> get data -> post data

in a particular process

Obviously, the user can login, get the data and go away from the computer
When he comes back, you start a new instance of login (presumably set to maxoccurs 0), but you don't want to allow post data immediately.
So in that case, when a new login instance is started, we explicitly lock other running instances AND their child actions so they can not be used as a target.


Not all relationships are AND! You can login _or_ remember (or even impersonate) to get a valid user to perform the next action.


We must capture both before and after. The before is mostly to BLOCK execution if it is not allowed. This does mean we need SOME identifier in the input.
If we don't have a capturing identifier in the before phase, we only execute at the end (?)

An action WITHOUT an identifier is worthless (?) though we have some automatic identifiers like correlation, device,...

## Looping

Going in a loop inside a process is currently not supported and not tested at this time.
The problem we have is that we can't keep track of actual lines executed, we just keep track of actions executed.
We do however have an incremental action/state index that allows us to deduce what the last executed step was. It is possible that based on this we can calculate that we are in a loop.

## Synchronous automatic

Currently all automatic actions are performed asynchronously. We may however in the future want to allow for synchronous chaining too. The runAutomatedAction is pretty well designed for it except that it skips by default, when running synchronously you don't want to skip by default because this would mean the process definition is inconsistent in some way.

## No good identifier

The process framework is designed to be able to wrap around "naturally occuring service interactions" that are not specifically designed to be handled by the process engine.
However, in some cases you _do_ want to be more specific and make sure everything belongs to the same process.
You can't really get the process instance id itself, but you can invent your own unique id to be matched with a unique process instance id, so just use the uuid generation service in combination with custom identification.
On the plus side, the code keeps working with or without the process engine.

## Start/stop vs stop only

Do we log at the start _and_ at the end of a service? 
Start and end has two downsides:

- more overhead (especially on the update)
- rollbacks needed in case of server failure

End only has other downsides:

- hard to set foreign keys on things like descriptions etc if the parent does not exist (yet)

## Uniqueness of identifiers

Identifiers are assumed to be unique

## Service repeating

The same service can be called multiple times within a particular process.
For each service action, you can set varying extractoers, and this might even be needed. For example in the beginning you might only have one id to match on.
At a later point you might have several ids to match on.

As long as you have only one process _instance_ that matches, we should be fine because the state is likely mutually exclusive in determining which action to run.
However, if you were to match multiple process instances of the same definition, we are in trouble.

## Nesting

Ideally we would allow you to track a parent service as the "start" of a process. That parent service then executes 3 steps in sequence.
A process with 4 steps would be nice.

However, this requires nested resolving, because the parent service isn't actually done by the time the children start.
I spent a lot of time trying to work this in, but it is really hard. The problems are:

- value capturing is only done at the _end_ of a service, so any linking of actions would be limited to correlation id. Because it's a nested situation this is actually likely OK.
- complex setups with any, all, state changes due to the parent finishing etc would be hard to "fake" until it actually takes place. but all of these might affect (from the process level) how things play out.

At the very least this requires an almost entirely separate code path and probably a more complex one at that. So I will leave it out of scope for now.

Ideally the process layer can function everywhere, for everything, all the time, but realistically it is to manage more complex processes.
If absolutely necessary you can structure your parent service correctly so you can actually trace the three child steps as a process, but it is unlikely to be necessary.

## Lax vs strict

The idea was: if a process is not in the correct state, should we allow the service to run or not?
However, the problem is, if the service is plugged in multiple times in the same process AND it is in none of the correct states, do you need to set them all to lax?
We'll await an actual usecase before fixing it. Another option might be to configure "lax" on the full process though this might leave instances in weird inbetween states that can never be resolved.
Again, first let's see the usecases.

## Blocking

A particular service (e.g. user login) can be part of multiple flows.
What happens if a certain is action is allowed by one flow but not by the other? Can we assume that if _any_ flow disallows it, it is blocked?

## Complex variable paths

We have had a situation where, depending on state, you want two actions in parallel or sequential.


## Flow

For reference:

- flow line is a "full" line visually
- limit line is a "dotted" line visually
- not line is a red dotted line visually

An action that has no incoming flow lines sits at the "root" of the state. That means it can be executed once the process is in that state (think CMMN)
If an action has at least one incoming flow line, it can only be executed if at least one action where the flow line(s) originate from has been executed. This "unlocks" this action.

If an action has an outgoing flow or limit line, it can only be executed UNTIL the resulting action has been executed. If it has multiple outgoing lines, it can only be executed until _any_ of the resulting actions are executed.

So a line determines the start window of an action execution and the end time until it can be executed. In that sense every flow line is also a limit line.

A limit line is only meant to curb the lifecycle of an action that is likely entirely optional (e.g. reminder mails). It becomes active onces its incoming flow line has been realized, and you don't want it to push the flow further, but you do want to limit the lifecycle of when it can be executed. 

A not line (not sure if it will remain) means we can explicitly state that an action should not be executed when another action has been executed.
It can allow for more complex setups, we'll see if it sees any use.

Incoming limit lines are ignored, they have no bearing on the execution possibilities of an action.

### Control statements

Automatic actions are "easy", this is just a sequence of events.
Non automatic actions however can mean long pauses between steps.

Suppose you have to parallel paths B and D:

A - B - C
  \ D /
  
Using regular flow lines C can be executed when B or D are executed.

There are two problems however:

- sometimes we want explicitly parallel statements that should all be executed
- suppose we execute B and C is a manual action that takes 1 more week before it is executed. In that week we can actually still run D. In a true "choice" situation, we don't want this.

To this end we have two control statements:

- and (all): this control statement is only "executed" once _all_ the incoming flow statements are resolved
- or (any): this control statement is executed once at least one incoming flow line is resolved.

The "and" can be used for parallel execution paths.
The "or" can be used to force a choice, if before C we set the "or", it will immediately execute once B or D are done. At that point we can wait a week for C without worrying about D accidently triggering.

Another control statement is a finalizer, it finalizes the process.

## Loop until

Can repeat until a certain condition is met with a max occurs limiting the amount of tries.
We could also set a repeat pattern (e.g. for transient error reprocessing)

# Potential todo's:

- conditions on process initializers: may only want to start a process if a subject is in a certain state. note however that it is unlikely a particular service is used when the target is both in a correct and incorrect state, awaiting first usecase