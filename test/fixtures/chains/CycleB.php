<?php
namespace Chains;

class CycleB
{
    public function next(): CycleA
    {
        return new CycleA();
    }
}
