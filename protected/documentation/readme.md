currently getPotentialServiceActions only returns ACTIVE processes!
this means we can't actually run processes in from previous versions!
we need a secondary state after deprecated -> "inactive" or something
deprecated processes are assumed to still be ongoing (?) every process instance of a deprecated definition should check whether it was the last one and deactivate the process.
at startup we should automatically do a check for deprecated-not-yet-inactive processes to see if they have running versions

we should NOT start a new process instance for deprecated processes! we just skip it, assuming there is a newer version or we don't care (anymore)



TODO:
- multischema support
	-> for the service listeners, need to check all connections
	-> for the cached "nabu.frameworks.process.providers.action.service.utils.getPotentialServiceActions", need to check all connections, need to feed back info on the connection-to-use as well!
		-> and feed this back via: nabu.frameworks.process.providers.action.service.utils.getActionsToRun to the tracker
-> or is the default service context always correct (?) -> in most cases probably yes!

do not update the data if the value hasn't changed
	-> especially for identification this is extremely annoying
	
implement version migration (the simple case -> rerouting to same state) for the endless


search instances on captured values (!)
capture external id values and features etc





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

## Migrating version

In most cases when you have a new version of a business process, it is OK for running processes to continue using the older version while new instances will get the new version. This is how it works by default.

In some cases however you _do_ want to migrate running instances to a newer version, reasons might be:

- a blocking bug preventing older flows from continuing
- endless flows that simply never stop would never see a new version otherwise

When migrating versions however, things can have changed drastically:

- entire states may no longer exist
- particular actions may no longer exist or have been added
- relations and requirements might have changed meaning the current action instances as they have occurred are no longer valid in a new flow or it may end up in a situation where requirements can not be fulfilled (e.g. new automated actions that never got scheduled but are waited upon).

A number of options:

1) State cleaning: the cleanest is that we reinitialize the process in a state (either the same state in the new version or a state you mapped it to if that no longer exists), that means all action instances no longer count towards future execution of the process in that state. This is clean because the original state instance (and all related action instances etc) will continue pointing to the original version they were evaluated against. This allows us to fully piece together the history. This approach usually works well for endless flows because they tend to be very case oriented without requiring specific action sequences.

2) We do best effort rewriting of state and action instances using the global reference id to link the same state (and action) cross version. This can however end up in a substate that is invalid. When small changes have been done that are guaranteed to be backwards compatible, this approach can work. Especially useful approach for migrating action-sequence-sensitive flows that have a blocking bug. However, there is a large chance this approach will break running processes. Additionally it "rewrites" history, making it harder to figure out what a process actually did.

3) We provide dedicated support for migration where you can add a "migration" action to the a state. this migration action is executed much like a regular action and can be chained (e.g. move to a specific action, add actions that are _only_ relevant for migration purposes as compensation etc.
Multiple migration blocks can be added to whitelist/blacklist/catch all specific migration source versions (e.g. when migrating from v20 to v30 you might want other compensatory steps than v25 to v30).

In the end we combine option 1 and 3 and do no provide support for option 2 because it is too error prone.
We will reroute previous versions into the same state. If we detect versions that are in a state that no longer exists, you are prompted to choose a new target state. In that state we can set "migration" actions that can be triggered at the root of the state (they can not have incoming lines) and can be used to trigger compensating actions.

Must be able to inject (or get) current process instance id -> you can plug in migration services that decide which path to take (e.g. output parameters used for conditional routing)
Custom compensation routines are used for "edge case" problems, most cases don't need migration at all or can be safely rerouted in the same state.

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