<?php
namespace Chains;

class CycleA
{
    public function next(): CycleB
    {
        return new CycleB();
    }
}
