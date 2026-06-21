<?php

// =============================================================================
// chains.php — Method-chain fixtures for TYP-03 / TYP-04 tests
// Each section defines classes for a specific chain depth and a test function
// containing variable assignments so TypeResolver can parse both class ASTs
// and assignments in one pass.
// =============================================================================

// -----------------------------------------------------------------------------
// Section 1 — 1-level chain
// $r1 = $b1->build();   depth = 1
// -----------------------------------------------------------------------------

class Builder1
{
    public function build(): Result1
    {
        return new Result1();
    }
}

class Result1
{
    public string $value = '';
}

// -----------------------------------------------------------------------------
// Section 2 — 2-level chain
// $r2 = $b2->step1()->step2();   depth = 2
// -----------------------------------------------------------------------------

class Builder2
{
    public function step1(): Step2
    {
        return new Step2();
    }
}

class Step2
{
    public function step2(): Result2
    {
        return new Result2();
    }
}

class Result2
{
    public bool $done = false;
}

// -----------------------------------------------------------------------------
// Section 3 — 3-level chain (exactly at DEFAULT_CHAIN_DEPTH = 3)
// $r3 = $b3->a()->b()->c();   depth = 3
// -----------------------------------------------------------------------------

class Builder3
{
    public function a(): Mid3A
    {
        return new Mid3A();
    }
}

class Mid3A
{
    public function b(): Mid3B
    {
        return new Mid3B();
    }
}

class Mid3B
{
    public function c(): Result3
    {
        return new Result3();
    }
}

class Result3
{
    public string $end = '';
}

// -----------------------------------------------------------------------------
// Section 4 — >3-level chain (exceeds DEFAULT_CHAIN_DEPTH)
// $r4 = $b4->w()->x()->y()->z();   depth = 4
// -----------------------------------------------------------------------------

class Builder4
{
    public function w(): Step4A
    {
        return new Step4A();
    }
}

class Step4A
{
    public function x(): Step4B
    {
        return new Step4B();
    }
}

class Step4B
{
    public function y(): Step4C
    {
        return new Step4C();
    }
}

class Step4C
{
    public function z(): Result4
    {
        return new Result4();
    }
}

class Result4
{
    public string $final = '';
}

// -----------------------------------------------------------------------------
// Test function — variable assignments for all four depth cases
// Wrapped in a function body so PHP parses assignments as valid statements.
// -----------------------------------------------------------------------------

function testChains(): void
{
    $b1 = new Builder1();
    $r1 = $b1->build();

    $b2 = new Builder2();
    $r2 = $b2->step1()->step2();

    $b3 = new Builder3();
    $r3 = $b3->a()->b()->c();

    $b4 = new Builder4();
    $r4 = $b4->w()->x()->y()->z();
}
