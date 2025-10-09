# TODO

Remove group id annotation on tasks in favor of narrative id

## Looping

### Context-based

We tag relations that are actualized with a _context_. On any given action you can then choose "reset context". It will reset the context which it is tagged in.
The context should be a variable that exists in the process data at the time of relation resolving (so after the source but before the target runs). We tag the instance.
These instances are used to evaluate whether or not something can happen.

When you then go back in time in a state (without starting a new state), you can have a line that "disables" all the relations tagged with that context. It should also disable itself because it too is a computational problem when we reach the source action.

We should visually indicate whether or not a relation is "contextualized". 

You can even use the same context id for each iteration because it disables the relations UP TO THAT POINT.

This means it can also be a fixed string.

## Uniqueness of process identifiers

An example process:

- we want to add attachments to a contract but each attachment has to go through a process (of validation, tagging,...)
- we want multiple attachments to be processed in parallel

In this example we can't use the contract id as a unique identifier for the process. But we can't use it as a unique identifier for the REST services (that manipulate the attachment steps) either. So we _would_ capture the contract id in this case but not as an identifier.

Another example process:

- you want to publish a draft version of something which has to go through some steps
- only one publishing process instance can be active at the same time

It makes sense that you capture the id of whatever you are publishing as a unique identifier because there should not be multiple process instances at the same time.

However, suppose in that publish process, halfway through you are "cleared for publish" and it has been published locally but you want to tie up some loose ends in the process as well (clean up temporary stuff, notify third parties,...)
You might want the first part of the process to be a singleton but once you get into the tail end of the process you don't want a faulty third party integration to stop the user from doing another publish.

In the first part you want to capture your entity id as an identifier but later on it should loose that identification status.

## Conditional lines based on path

e.g. "this line is only valid IF action ABC was run before this point" (either in the same state or before)
	-> if cross state, do we allow cross state instances? do you need to make this obvious?
if we also have "this line is only if action ABC was NOT run before this point
	-> then we can probably remove start & stop lines in favor of this
	
We need to provide this with dropdowns and use the internal global ids

## Wrong interpretation of incoming conditional lines

Currently if a condition on a line evaluates to false, it is as if that line does not exist.
This is probably OK in most cases (e.g. ANY/ALL) but is not ideal when NO line remains after filtering.

Because this overlaps with the original usecase where an action could be run if it had no incoming lines at all.
The can run should take into account that if there are no valid incoming lines, it should not be able to run it.

This might clash however with calculation of "manual" actions where we might want to allow certain actions to be taken even if it can not be done because of line conditions?
Not sure if this is a valid usecase though, the usecase is where a process stops if 1 of 2 paths is not possible (both have to be actively toggled). You can manually force a particular path currently.
However, we could also say that you have to update the state to force the manual path!

# Failed vs Cancelled

An action has two possible outcomes from a flow perspective: it is either successful or it failed. Both of these can have consequences in the process itself.

There is however a third state "CANCELLED" which means the action was started but not finished, therefor there is no positive or negative outcome. 
There is no outcome, so you don't want the flow to progress but you also don't want to fully delete the process action instance because it did happen up to a point.

There are a number of reasons why an action might be CANCELLED, for example when the server starts up it will automatically rollback any actual tasks (default behavior of task framework) that were left in the RUNNING state, because it presumes the server crashed.
Therefor any associated process action instance should be marked as CANCELLED because the task retry will not reuse the existing action instance but create a new one.

The same happens when an action goes into ERROR (which is a transient state). Should you opt to retry, the action instance should be set to CANCELLED.

Up until the addition of the nw state, such edge cases were actually set to FAILED but no failure flows were evaluated. This meant, by and large that it "worked". However, if you were to have a service that has an incoming failure flow and is not automatically executed (so waiting for an external trigger), it will evaluate the source actions at the time of invocation.
If the source actions are set to FAILED instead of CANCELLED, it may actually allow execution which was not intended from the flow perspective.

# State level actions can be repeatedly executed

In the current setup the rule is:

- you must have at least 1 incoming line that resolves
- you must have no outgoing flow lines that resolve

However there is an exception to that rule: if the incoming line is a STATE line, you can always execute it.

In the "nabu.frameworks.process.providers.action.service.utils.canRunActionForProcessInstance" we drop the outgoing lines for checking when a state line is resolved.
This allows it to proceed.

This is a remnant from an original though experiment about looping WITHIN a state instance.

However, you would need to be able to identify each branch within the state instance. If you can't do that, it doesn't matter to have multiple branches.

So it seems prudent to not allow multiple execution of root actions once a outgoing line is resolved, this is also more in line with "normal" behavior.

@2024-10-07: modified behavior to be more inline with general expectations: once an outgoing line is executed, we no longer allow execution. Looping and multiple branches are currently not supported anyway.

# Link to user

In the original setup, every action would update the $userId, $deviceId and $sessionId variables to whatever user was running that action.
This was aimed at making it easier to use the $userId identification etc.

However, as we added stuff like human actions and "run action" to batch trigger services etc, this meant that outside actors were running actions which would in turn end up with them configured as $userId.
This was not the intention.

The idea is to use more it more as an "assignedTo" to make it easier to link back to a particular user. For this reason it was made opt-in so you have more control over when and how it was assigned. In some situations (e.g. when switching from anonymous to logged in) you may even want to capture it explicitly.

# Data mapping for actions

In the past we could only do data input mapping for "automatic" actions.
However, there is now also the option to toggle "manual" so we can run an action through the process engine GUI manually. These also would need input mappings even if it is not initially set to automatic.
Apart from that however, we can now do "action.run" which uses the "code" to select the best matching action(s) to run on a given process instance. These actions are not always set to automatic and may not even be set to manual.
So in the end, currently, we always allow input data mapping for an action, even if it is not set to automatic or manual. In the future if the overlap for run action and manual/automatic is large enough, we might restrict it again to only be available in those usecases.

# Check permission

Permission checking is different from state checking. The process engine is primarily a state enforcement framework.
However when it is intercepting for example a service call (that is unaware of the process engines existence), we may want to perform an additional security check beyond the traditional state check.

It is important to note however that permission checking should not be considered an alternative to state checking, which means a lot of problems can and should be solved with conditional flow lines rather than a permission check on the target action.

For example when a service is run and the process engine intercepts it, it first performs a state check. It will then also perform a security check that (if the state allows it) makes sure that whoever is trying to run it is allowed to do so.

However, if the state dictates that after that service intercept a task should be scheduled to run a service automatically, we will NOT perform a permission check on that service run. It will run with the same credentials as whoever submitted it but if it is not allowed to do that, the state condition should have taken that into account.
Same with signals (which may spawn from different processes) where a condition on the signal should be used rather than a permission check.

Human tasks are a slightly tougher one, you want to offer users only tasks that they can manage in a list view, this is hard to combine with an application level check that correlates a single user to a single task.
You don't want a task to show up in a user inbox only to end up throwing an error because he is not allowed to submit it.

So until we can solve the listing issue in an acceptable way, we will not check permissions on the human task, it is up to the interface that serves up the human tasks to make this distinction to the best of its efforts.

There are many types of checks you may want to perform when a particular action is run:

- is the current $userId of the process also the one who wants to run it?
- is it perhaps a user that has not done any previous actions in the process? (sometimes a requirement for "review" steps)
- do you have a certain permission in a certain context based on one of the identifiers in the process?
- is it currently between business hours?
- ...

This goes far beyond the traditional roles/permissions check we often perform.

For this reason I have added a checkPermission spec that is run BEFORE the action is taken to ensure that whoever is trying to run it, actually does that.

# Root service only

In most cases we _dont_ want to capture nested services but only root services.
However, we _do_ want to be able to capture a service and also capture a service that wraps that service (canonical example: send mail and send reminder mail).

We could add a new boolean to "only" capture if it is a root service (though keep in mind that async is executed with service invoke so needs to special handling to calculate rootiness).
This boolean could be set to true because in 95% of cases that is the intended behavior.

# Indexes

The process data value might contain large values (e.g. when capturing full complex types)
In this case postgresql might complain when using a regular index. For example:

```
Caused by: org.postgresql.util.PSQLException: ERROR: index row requires 15536 bytes, maximum size is 8191
```

You can however replace the regular index with a gist index:

```
drop index idx_process_data_value;
create index idx_process_data_value on process_data using gist (value);
```

If this does not work you might need to enable the extensions first:

```
CREATE EXTENSION pg_trgm;
CREATE EXTENSION btree_gin;
CREATE EXTENSION btree_gist;
```

# Correlation id resolving in a loop

Looping over a list to generate new process instances (or continue existing ones) in bulk poses a problem for correlation id based matching.

# Synchronous action execution

Currently you can not execute actions synchronously that occur within a different state (so after a state transition).
This is because the state transition itself is only saved once the action that triggered it is succesfully completed.

We "could" update this to use local transitions to insert the state instance, but then we also have to listen to failures and rollbacks of the transaction context to "unwind" any state transitions that may have occurred (it can be multiple)

Until we do this refactor, the general rule of thumb is: do not use synchronous actions cross states, only within a state.

# Connection Resolving

When a service is called, we need to know which connection to use to resolve process definitions and add any logs.

In a far away past, connection resolving was done in two stages:

- is there a connection explicitly configured for the service that is being run or any part of its path, for instance you could redirect the whole process framework to a particular connection by registering "nabu.frameworks.process" in the context of that connection
- if not, check if there is a connection for the _root_ context of whatever we are running now

Because we wanted to create more "utility" packages that have their own database connections a new resolving step was added in between those two:

- is there any service in the service stack (starting from the current service all the way up to the root) that has a connection? if so use that.

It is not technically impossible to have the process engine work across multiple connections simultaneously (so track a single service in multiple connections) but the sheer complexity of this makes it a hard sell.

This means the process engine must choose a singular connection every time it hooks into a service.

In the first iteration, the process engine _explicitly_ resolved a connection based on the root service context. This bypasses any of the other resolving steps. Most notably it prevented you from centralizing all processes into a single connection by configuring an intercept.

However, when we switched to hierarchical resolving, where each step along the way is evaluated, that would mean each and every service in the service stack that had a connection configured for it, would intercept the process engine, even if it does not support processes.

There are however two valid scenarios:

- most processes are controlled by the overarching business logic, so root resolving is generally logical
- you can imagine some utility projects have their own need for processes (e.g. a microservice for contract management requiring a process to handle creation of a new contract)

However, the process engine has to choose and choosing is losing.

Short term a new concept was added to connection resolving: required dependencies. This means we can check the full service stack but not stop at the first random connection, but instead a connection that has the process model synced, indicating it is process-ready.
This means utility projects can choose to intercept process trackers or not.

To be tested: because of this setup, the process engine might end up tracking nested calls that are logged in different connections. It is currently not entirely clear if this will work cleanly. This will need to be checked.

If a higher level service calls a lower level business package that has process support, the higher level project will never be able to capture any particular steps that happen inside of the business package.

For instance suppose we have "utilityProject.contract.create" which starts of its own process.
Our higher level package could wrap this in "higherProject.contract.create" which _it_ could track. However it would never be able to track all the details that happen in the utilityProject.

Instead, if this becomes necessary, the idea is to use process signals to fix this. A process signal is currently emitted in the connection context of whoever is firing it.
We could however toggle that it must fire in _all_ contexts, which means a process running in the utilityProject could send a signal that can be intercepted by the higherProject.

We could then wonder whether the utilityProject must explicitly emit a signal or whether every step in the process is automatically converted into a signal _if_ someone subscribes to it.
The advantage of the latter is that (as with general hooking) you don't need to know at design time of utilityProject which parts will be interesting to other systems later on nor require a retrofit if you missed one.

# TODO

- human task
- send signal: allow sending of signal to the process instance externally
V flow-failed: allow flow lines that are specifically triggered on "failed" steps (so finalized errors), this can be used for human tasks, service exceptions,...
- finalizer: allow to be run in the future and choose the state (succeeded or failed). usecase is autocleanup of processes where after 3 reminder mails and still no progress, you just want to stop the process.
- state transition: allow executing the target state in a different process instance, this (combined with flow-failed) can be used for complex compensation flows. the instances should obviously be related somehow
- rest service for sending signal: /signal/{processActionId}?identifier=value where you can use a limited set of explicitly whitelisted identifiers
	- also need to add security where you can set an permissionAction on the process action (defaults to the process code + process action code) and specify a captured data value to use as permission context

- captured data tonen
- ? ignore error automatisch aanzetten als ge een failed transitie toevoegt (of toch ten minste waarschuwen)
- force beter visualiseren (?)
- lijntjes kunnen manueel verbeteren
- correlation id matching waarschuwen als dit 2x op dezelfde service gebeurt en met loops enz

- for task system: do we want to differentiate between "best effort" services and regular services. the best effort does not fail if the process is no longer in the correct state (the current behavior), the other one just runs it
	- we will always need the wrapper though because it contains the identification of the process, otherwise we would need capture-based identification of the process (or we could use contextId?? inject in runtime as taskContextId and pick it up as process instance id?)
	- if we don't need identification, we could run a "raw" task without a wrapper service, it would be more readable at least

## Still check actions for automated

Currently automated actions bypass a number of checks because we assume we know the process instance it is for.
That is true...for that process definition. We might want to capture the service call still in another process.
For instance we send a mail to a business relation and want to auto-capture it in the user process as well.

## Get earlier versions!!

currently getPotentialServiceActions only returns ACTIVE processes!
-> basically once you release a new version of a process, the older instances are no longer picked up for matching
this means we can't actually run processes in from previous versions!
we need a secondary state after deprecated -> "inactive" or something
deprecated processes are assumed to still be ongoing (?) every process instance of a deprecated definition should check whether it was the last one and deactivate the process.
at startup we should automatically do a check for deprecated-not-yet-inactive processes to see if they have running versions

we should NOT start a new process instance for deprecated processes! we just skip it, assuming there is a newer version or we don't care (anymore)

we could do a secondary check for process matches of deprecated processes
-> note that we still can not have the same process (even different versions) match the same invocation (TOO-MANY-PROCESSES)

## Allow identification at end

Some services (login, remember,...) simply can't be designed with an identifier in the input.
However, we _can_ capture identifying data from the pipeline (or the output).

So basically, in the beginning we check for services that either have an identifier in the input OR can be used to kickstart a process.
At the END of a service, we want to check specifically for actions that have no input identifiers but do have output identifiers and can not be used to kickstart a process.

We still (retroactively) link it to the process.

## Support multiple correlation ids

Currently, each action will _update_ the correlation id in the process data for nested matching.
This is OK unless we have parallel execution WITH nesting.

For correlation-id based identification of an action, perhaps check action instance logs as well?

## Synchronous automatic services

Perhaps we want synchronous automatic service execution in the future to preprocess/block/transactionally hook into...running services.

## Best effort

When you run automatic tasks, you have the option to run it at some point in the future.
If you run say a task 7 days into the future, the process can do other stuff in the meantime and progress to a point that the task is no longer allowed to run.
However, if the task is no longer allowed to run, throwing an error does not really help you solve this: you can't retry and if you set to failed any failure flows are equally likely not allowed to run anymore.

When you run tasks asynchronously "immediately" though (so without an explicit timeout), you expect them to either execute or end in an error.

So currently the "best effort" ability of an automated task is fully dependent on whether or not you have filled in a schedule/delay or not. In the future we might add an explicit boolean if necessary.

# DONE

## ERROR

If we set an action to ERROR, we also set the process to ERROR, blocking further moves.
The reason is that the ERROR needs to be resolved, this can be done in 2 ways: reprocess and set to failed

However, both reprocess and set to failed (assuming failure flows exist), require the process to be in a certain state. Allowing the process to continue executing with an error means we might never be able to resolve that error.

Because we have failure flows however, we have decided to set actions to autofail by default because too many processes are accidently stopped because someone forgot to set the toggle. Especially given the explicit modeling option of a failure flow, this becomes useless.

## Auto fail

Some actions are expected to fail from time to time. We want to automatically set them to failed instead of halting the process until someone looks at it.




TODO:
- multischema support
	-> for the service listeners, need to check all connections
	-> for the cached "nabu.frameworks.process.providers.action.service.utils.getPotentialServiceActions", need to check all connections, need to feed back info on the connection-to-use as well!
		-> and feed this back via: nabu.frameworks.process.providers.action.service.utils.getActionsToRun to the tracker
-> or is the default service context always correct (?) -> in most cases probably yes!

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

## Nesting

It would be nice to know which action instances are actually nested because suppose you have this setup:

- wrapper-action: ERROR
	- nested-action1: SUCCEEDED
	- nested-action2: ERROR

In the vast majority of acses the transaction of nested-action1 will also have been reverted, so even though it is marked as successful, it actually did not fully work.

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
We have identified two separate situations:

- there IS a matching process instance and it is not in the correct state: we do not allow execution regardless of the lax/strict setting
- there is NO matching process instance: by default we allow execution of the service. By toggling "strict", we block the execution.

At first the second rule was not in place and everything was strict by default. However we quickly noticed that utility services immediately bump up against this problem. For example you have different processes around nodes (to track their lifecycles). If you set an external id on a node and want to track this action in multiple processes, most of them will not agree with this action.

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