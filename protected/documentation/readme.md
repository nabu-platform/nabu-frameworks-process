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

Some actions can be nested, for example we offer a rest service as an API. It is called and actually executes 3 steps.
We want to model all 4 to make it clear that everything happened (or not).
One child might succeed and the second fail. This will revert the whole transaction though undoing the first step as well...
It is important to keep track of "nested" calls for this reason.

If a nested task has an automatic child, this will be created as a task in the same (default) transaction context as the child.
This means, if the child has a scoped transaction, the task will be created. if the child does not (most likely usecase) the transaction will be rolled back, as will the creation of the task. So we should have consistent behavior.

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